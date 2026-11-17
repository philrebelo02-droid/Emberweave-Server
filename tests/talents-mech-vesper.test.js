'use strict';
/* Vesper "The Annotator"'s talents as data on the mechanics layer (talents-mech/vesper.js), family by family on the still field
   (tests/talents-lab.js), then the caps, whole-fight determinism, the no-talent identity, and Phil's 95% ceiling.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured
   with her talents switched off for one hit (plainHit) or for one cast on the same field (a second lab would replace the arena).
   Ranks are NOT all 5: read the rank off T.talent (e.g. Narrow Margin 3, Final Draft 1). CC sizes: Phil's uniform table (v790)
   replaces an authored control with the table value - Errata's field silences for the AoE 1.5 s, Puncture for single 3.0 s
   (freeze) / 3.0 + 3.0 (silence) - and a talent's "+x s in full" is added on top of the table value, raw (x / 0.7 on the option).
   Lab conventions (measured while writing these tests):
   - The lab steps at SIM_STEP x BATTLE_PACE 0.82 = 0.0273 s a step: secs(0.5) is 18 steps = 0.492 s, so a hazard's first tick
     has NOT arrived half a second after the cast. Wait for a state with till(fn) - it steps one lab step at a time and returns
     the number of steps taken (x 0.0273 = the elapsed seconds). A control does not decay inside the step that writes it, so a
     till'ed value still asserts tightly (0.02-0.09 by how many steps the wait cost).
   - A silenced enemy's ability cooldowns STOP (the engine freezes greenCd/blueCd while silencedT > 0): assert cooldown
     DIFFERENCES, or subtract the elapsed steps from the absolute you expect.
   - An enemy's control on Vesper lands at 1 - max(0, target level - its skill level) x 1%: her lab level 100 makes the lab
     foes' controls bounce off - set a foe's level to hers when its control must land, or to 200 when hers must be resisted
     (Puncture's ccApply carries no (1 - ctrlRes) factor - ctrlRes does not help against it; the level gap does).
   - Loose Leaf's back pass is 0.7/1.1 of the out pass. Bare castLL calls overwrite the armed return (u._pageBack): only the
     LAST bare cast's pages come back. Three bare casts in a row land three out passes and ONE return: the measured "out" is
     three casts' worth - divide by 3 for a single cast. Space casts with castLLb (cast + 0.6 s) when each return must land.
   - Errata's field lives 5 s (its silence ticks at 0.52 s + every 0.52 s while it lives): anything measured around a Deadline
     (10 s) needs a fresh castErr, and an enemy that steps in late is only silenced by Redaction, never by the field.
   - ccHit writes a held enemy's freeze straight onto stunned; a press only resolves on a free unit (silenced/stunned blocks
     the fire, and a field inside range re-silences every tick) - clear f.silencedT around presses, every step of the way.
   - Copyist's Eye and Sharp Pages feed ONE pool (ll.k, added): +3% x 3 and +2% x 5 is a flat 1.19 on every Loose Leaf hit,
     the back pass included; Paper Cut (ll.back) multiplies on top of that on the return only.
   - Marks from a Deadline / Puncture and the Proofread status rebuild on the talent tick: V.step(3) after the cast before the
     reading that depends on them.
   Places (metres from Vesper, centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0) F3 (0,6) F4 (5.5,6) F5 (11,6) F6 (0,12) F7 (5.5,12) F8 (11,12).
   Loose Leaf's line runs along y = 0 through F0, F1, F2 (in that order) with 3 foes; F3 and up stand off it.
   Lab units are HELD (stunned 1e6), Vesper too: a held Vesper does not think. go() lets her think without acting; free() frees the
   enemies (standing, not swinging). Errata's field lands AT ONCE in the lab (the cast verb delivers forms); its first tick is
   ~0.5 s later (18 steps). Loose Leaf's pages return ~0.37 s after the cast (0.45 x BATTLE_PACE 0.82): every Note/Ink/Crossed
   that rides the return needs castLLb (cast + 0.6 s), not a bare castLL.
   Lab foes are plain rank-0 Vaels: they have NO abilities (greenAb/blueAb null) - a test of the enemies' cooldowns fabricates them.
   Lab skill level 10. Run: node --test tests/talents-mech-vesper.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,mark,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='vesper', S=ids=>full(H,ids), R=id=>T.talent(H,id).ranks;
const TEAM=['vael','sylthaine','vireo','vex','vesper'];
test.afterEach(()=>{ FX.define(H,null); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const VMX=s=>vm.runInContext(s,NOW.ctx);
const plain=(o,fn)=>fn(lab(H,null,o));
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const till=fn=>{ let i=0; for(;i<160;i++){ if(fn()) return i; V.step(1); } return i; };   // step one lab step at a time until fn() holds; returns the steps taken
const ust=(L,t,name)=>{ const o=t._talM&&t._talM[L.v.uid], m=o&&o['#'+name]; return (m&&V.now()<m.until)?m.v:0; };
const ink=L=>stack(L,'vpInk');
const st=L=>L.T.s.vp;
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const go=L=>{ const v=L.v; v.stunned=0; v.speed=0; v.atkCd=1e9; v.greenCd=1e9; v.blueCd=1e9; v.energy=0; v.energyReg=0; v.target=null; };
const free=L=>{ for(const f of L.F){ f.stunned=0; f.fearT=0; f.silencedT=0; f.level=1; f.ctrlRes=0; f.speed=0; f.atkCd=1e9; f.greenCd=1e9; f.blueCd=1e9; f.energy=0; f.energyReg=0; } };
const freeA=L=>{ for(const a of L.A){ a.stunned=0; a.fearT=0; a.silencedT=0; a.level=1; a.ctrlRes=0; a.speed=0; a.atkCd=1e9; a.greenCd=1e9; a.blueCd=1e9; a.energy=0; a.energyReg=0; } };
const holdF=L=>{ for(const f of L.F){ f.stunned=1e6; } };
const kitF=L=>{ for(const f of L.F){ f.greenAb={cd:9}; f.blueAb={cd:8}; } };   // lab foes ship no abilities: fabricate them where a row reads the enemies' cooldowns
const castErr=(L,t)=>V.cast(L.v,'green',t);
const castLL=L=>V.cast(L.v,'blue');
const castLLb=L=>{ castLL(L); secs(0.6); };   // Loose Leaf's back pass lands ~0.37 s after the cast: Notes/Ink/Crossed ride it
const castP=L=>V.cast(L.v,'ult');
const hitOn=(L,amt,o)=>lost(L.v,()=>V.hit((o&&o.src)||L.F[0],L.v,amt||1000,Object.assign({kind:'true'},o||{})));   // an enemy's hit on her (true damage unless said)
const foeHit=(L,t,amt,o)=>lost(t,()=>V.hit((o&&o.src)||L.F[0],t,amt||1000,Object.assign({kind:'true'},o||{})));   // an enemy's hit on a chosen unit
const allyHit=(L,a,t,amt,o)=>lost(t,()=>V.hit(a,t,amt||1000,Object.assign({kind:'true'},o||{})));
const myHit=(L,t,o)=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{})));
const press=(L,t)=>{ t.__fired=0; t._pend={t:0.5,sm:1,lv:1,hero61Slot:'green',spell:true,fire:()=>{ t.__fired=1; }}; };   // an enemy presses a Green (a fresh object each press)
const sm10=()=>VMX('skillMul(10)');
const swingAt=(L,t)=>{ L.v.target=t; L.v.atkCd=0; L.v.stunned=0; V.step(14); L.v.atkCd=1e9; };   // one basic attack (her mind free; ~14 steps for the swing to land)

test('Vesper: every talent is accounted for - 9 plain stats, 110 with rows, none waiting; the renames landed; the cap sentences are in the texts',()=>{
  accounting(H,[119,9,110,0,0]);
  for(const id of ['rp_5_1','rp_9_3','rp_10_4','sv_2_2','sv_10_3','sv_11_4','sc_1_2','sc_4_3','sc_8_4']) assert.ok(FXN.has(H,id),id+' is a plain stat');
  const names={}; for(const tr of T.trees(H)) for(const t of tr.talents){ assert.ok(!names[t[3]],'a name used twice: '+t[3]); names[t[3]]=1; }
  const REN={'rp_1_3':'Steady Nib','rp_4_1':'Broad Margin','rp_7_1':'Side Notes','rp_8_3':'Small Print','rp_8_4':'Caustic Ink','rp_10_1':'Archive Copy','rp_11_4':'Leather Bound','rp_12_3':'Hot Press','sv_1_1':'Twice Written','sv_1_4':'Ink Fountain','sv_2_4':'Brimming Well','sv_6_3':'Swift Quill','sc_1_1':'Press Date','sc_1_2':'Sturdy Desk','sc_3_1':'Late Shift','sc_4_2':'True Copy','sc_6_2':'Gilded Edge','sc_7_1':'Urgent Order','sc_11_3':'Constant Light'};
  for(const id in REN) assert.equal(T.talent(H,id).name,REN[id],id+' renamed to '+REN[id]);
  assert.equal(T.talent(H,'rp_9_2').name,'Final Draft','Final Draft stays (it is hers alone)');
  for(const id of ['rp_11_4','rp_12_4','sv_3_2']) assert.ok(/at most 30% off a hit/.test(T.talent(H,id).text),id+' states the 30% group cap');
  for(const id of ['sc_2_4','sc_6_1','sc_10_3']) assert.ok(/at most 25% off a hit/.test(T.talent(H,id).text),id+' states the 25% group cap');
  assert.ok(/4 s in a row/.test(T.talent(H,'rp_10_3').text),'Eleven Errors states the 4 s run cap');
  for(const id of ['rp_11_3','sc_12_3']) assert.ok(/4 s past the freeze/.test(T.talent(H,id).text),id+' states the silence cap');
  assert.ok(/0\.7 s/.test(T.talent(H,'rp_3_2').text)&&/0\.7 s/.test(T.talent(H,'rp_7_4').text),'Errata Slip and Redaction: the landed 0.7 s');
  assert.ok(/0\.35 s/.test(T.talent(H,'sv_3_4').text),'Blotted: the landed 0.35 s');
  for(const id of ['rp_13_3','sv_13_2','sc_13_3']) assert.ok(FXN.mech(H).talents[id],id+' has rows');
});

test('Vesper: her real kit, as the talents read it - Errata (the field, the straight-written silence), Loose Leaf (out and back, the vpBack pair), Puncture (the freeze and the capped silence), Scriptorium',()=>{
  plain({foes:4,big:true},P=>{ const {v,F}=P; go(P); free(P); castErr(P,F[0]);
    const hz=VMX('groundHazards').filter(h=>h.src===v); assert.equal(hz.length,1,'Errata leaves one field'); near(hz[0].r,3*V.METER,'3 m centre to centre');
    near(hz[0].silence,1.5,'the silence option is the uniform control table value (AoE 1.5 s; the authored 0.6 is replaced, v790)');
    till(()=>F[0].silencedT>0); near(F[0].silencedT,1.5*V.ccNerf,'written straight on the first tick: the table 1.5 s x 0.7, no resist roll',0.05);
    assert.equal(F[3].silencedT||0,0,'(not one 6 m off it)');
    const h=F.map(f=>f.hp); castLL(P); const d=F.map((f,i)=>h[i]-f.hp);
    assert.ok(d[0]>0&&d[1]>0&&d[2]>0,'Loose Leaf strikes every enemy on the line to the farthest one'); assert.equal(d[3],0,'(not one 6 m off it)');
    assert.ok(v._pageBack&&v._pageBack.list.length===3,'the return pass is armed for the same three');
    secs(0.6); const d2=F.map((f,i)=>h[i]-f.hp); for(let i=0;i<3;i++) assert.ok(d2[i]>d[i],'the back pass cuts them a second time'); assert.equal(d2[3],0,'(not the off-line one)');
    for(const f of F){ f.stunned=0; f.silencedT=0; } at(P,F[0],0,9);   // the field's silence is done with, and F0 steps out of the field: its damage ticks would muddy the reading
    const hv=F.map(f=>f.hp); castP(P); near(F[0].stunned,3*V.ccNerf,'Puncture freezes EVERY enemy: the table single 3.0 s x 0.7',0.02);
    near(F[0].silencedT,V.cap('silencedT'),'and silences: (3.0 + 3.0) x 0.7 = 4.2, at the 3.85 s ceiling',0.02);
    secs(3*V.ccNerf+0.05); near(F[0].silencedT,V.cap('silencedT')-3*V.ccNerf,'1.75 s of the silence still runs when the freeze ends',0.09);
    assert.equal(F[0].hp,hv[0],'Puncture itself deals no damage (the field under F0 did, while it stood there)'); });
  plain({foes:2,allies:2,big:true},P=>{ const {v,A}=P; go(P); const e0=A.map(a=>a.energy); secs(1.05);
    for(let i=0;i<2;i++) near(A[i].energy-e0[i],(v.passMul||1)*1.0,'Scriptorium: 1 x passMul energy a second to every ally',0.08); });
});

/* ============================== NOTES AND CORRECTED ============================== */
test('Vesper / Marginalia: a Note for each enemy both passes cut (max 3, lapse 8 s after the last), at 3 Notes Corrected - the next Green or Blue fails (cancelled from the press, no effect), once every 15 s',()=>{
  const L=lab(H,S(['rp_1_2']),{foes:3,big:true}), {v,F}=L; go(L); free(L);
  castLLb(L); assert.equal(ust(L,F[0],'vpN'),1,'one cast, both passes: 1 Note'); assert.equal(ust(L,F[1],'vpN'),1);
  castLLb(L); castLLb(L); assert.equal(ust(L,F[0],'vpN'),0,'at 3 Notes: they clear - Corrected'); assert.ok(st(L).e[F[0].uid].corr,'its next press fails');
  const corr1=st(L).corrN||0;
  press(L,F[0]); secs(0.3); assert.equal(F[0]._pend,null,'the press is cancelled by the game\'s own castCancel'); assert.equal(F[0].__fired,0,'nothing resolves');
  press(L,F[0]); secs(0.6); assert.equal(F[0].__fired,1,'(without the Correction a press resolves in this lab)'); F[0]._pend=null;
  castLLb(L); castLLb(L); castLLb(L); assert.equal(st(L).corrN,corr1,'locked 15 s: no second Correction from fresh Notes');
  secs(15.2); castLLb(L); castLLb(L); castLLb(L); assert.equal(st(L).corrN,corr1+3,'15 s later all three on the line Correct again');
  const N=lab(H,S(['rp_1_2','rp_4_3']),{foes:3,big:true}); go(N); free(N);
  castLLb(N); const n1=ust(N,N.F[0],'vpN'); assert.ok(n1>0,'a Note down (with Footnotes)'); secs(11.0); assert.equal(ust(N,N.F[0],'vpN'),n1,'Footnotes: a Note lives 8 + 1 x 5 = 13 s'); secs(2.5); assert.equal(ust(N,N.F[0],'vpN'),0,'then lapses');
  const M=lab(H,S(['rp_1_2']),{foes:3,big:true}); go(M); free(M); const p=plainHit(M,()=>hitOn(M,1000,{src:M.F[0]}));
  castLLb(M); castLLb(M); assert.equal(ust(M,M.F[0],'vpN'),2,'2 Notes on it');
  near(hitOn(M,1000,{src:M.F[0]}),p*(1-0.01*5*2),'each Note makes it deal 5% less (1% a rank at 5/5)',1e-9);
});

test('Vesper / Red Ink and Black Ink (PICK ONE): Red Ink a Note on each pass; Black Ink 1 Note on every enemy within 3 m of the Corrected one',()=>{
  const R=lab(H,S(['rp_1_2','rp_5_2']),{foes:3,big:true}); go(R); free(R);
  castLLb(R); assert.equal(ust(R,R.F[0],'vpN'),2,'Red Ink: out pass and back pass each a Note');
  const B=lab(H,S(['rp_1_2','rp_5_3']),{foes:3,big:true}); go(B); free(B); at(B,B.F[1],6.5,0);   // F1 2 m from F0 (both on the line)
  castLLb(B); castLLb(B); castLLb(B); assert.ok(st(B).e[B.F[0].uid].corr,'F0 Corrected');
  assert.equal(ust(B,B.F[0],'vpN'),1,'the same pass left it a fresh Note');
  assert.equal(ust(B,B.F[1],'vpN'),1,'Black Ink: every enemy within 3 m gets 1 Note');
  const B2=lab(H,S(['rp_1_2','rp_5_3']),{foes:3,big:true}); go(B2); free(B2); at(B2,B2.F[1],12.5,12);   // F1 14 m from F0, 12.4 from F2: no chain reaches it (body-gap > 3 m)
  castLLb(B2); castLLb(B2); castLLb(B2);
  assert.equal(ust(B2,B2.F[1],'vpN'),0,'(not one far off the line, out of every 3 m chain)');
});

test('Vesper / Errata Slip (the 0.7 s), Marked for Reprint (6% more from her, the Second Verse link), Proof Copy (deals less for 4 s)',()=>{
  const L=lab(H,S(['rp_1_2','rp_3_2','rp_n1','rp_7_2','sv_1_1']),{foes:3,big:true}), {v,F}=L; go(L); free(L);
  castLLb(L); castLLb(L); castLL(L); till(()=>F[0].silencedT>0);   // the 3rd cast's return delivers the 3rd Note: Corrected
  near(F[0].silencedT,1*V.ccNerf,'Errata Slip: silenced 1 x 0.7 = 0.7 s, written on the Correction',0.06);
  const p0=plainHit(L,()=>myHit(L,F[0])); near(myHit(L,F[0]),p0*1.06,'Marked for Reprint: it takes 6% more from her for 3 s',1e-9);
  const h=F[1].hp; castErr(L,F[1]); secs(0.6); assert.ok(h-F[1].hp>0,'a cast: the link armed (Correction on F0, a cast of hers next - the field ticks)');
  secs(1.1); assert.ok((st(L).ecN||0)>=1,'Marked for Reprint + Second Verse learned: that cast was written twice whatever the count');
  const q0=plainHit(L,()=>hitOn(L,1000,{src:F[2]}));
  castLLb(L); castLLb(L); castLLb(L);   // F2 Corrected (its notes clear; Proof Copy lands)
  { const m=F[2]._talM&&F[2]._talM[v.uid]; if(m&&m['#vpN']) m['#vpN'].until=0; }   // isolate Proof Copy: the Notes' -5% each (up to -15%) is Marginalia's own test
  near(hitOn(L,1000,{src:F[2]}),q0*(1-0.02*5),'Proof Copy: a Corrected enemy deals 10% less for 4 s',0.02);
});

/* ============================== STRUCK OUT ============================== */
test('Vesper / Struck Out: Errata\'s silence adds 0.3 s x rank in full to the ability closest to ready (once a field per enemy); Lost Lines, Errant Hand, Archive Copy',()=>{
  const L=lab(H,S(['rp_2_4','rp_5_4','rp_9_1','rp_10_1']),{foes:3,big:true}), {v,F}=L; go(L); free(L); kitF(L);
  const f=F[0]; f.greenCd=3; f.blueCd=9; const e0=v.energy, so0=st(L).soN||0;
  castErr(L,f); const e=till(()=>(st(L).soN||0)>so0)*0.0273;   // the field's first tick silences it: Struck Out lands, the cooldowns freeze at once
  near(f.greenCd-f.blueCd,(3-9)+0.3*5+0.05*5,'the closest-to-ready ability takes +1.5 + 0.25 in full (both cooldowns stopped together when the silence landed)',0.01);
  near(v.energy-e0,1*5+e*(v.passMul||1),'Lost Lines: 1 energy a rank from the Struck Out (plus her own Scriptorium drip)',0.08);
  const p=plainHit(L,()=>hitOn(L,1000,{src:f}));
  near(hitOn(L,1000,{src:f}),p*(1-0.015*5),'Errant Hand: it deals 7.5% less for 3 s',1e-9);
  secs(3.1); near(hitOn(L,1000,{src:f}),p,'(3 s and it is over)');
  const f2=F[1]; f2.greenAb={cd:9}; f2.blueAb={cd:8}; f2.greenCd=5; f2.blueCd=1; const so1=st(L).soN||0; castErr(L,f2); till(()=>(st(L).soN||0)>so1);
  near(f2.blueCd-f2.greenCd,(1-5)+0.3*5+0.05*5,'a field strikes each enemy out once (blue was closest)',0.01);
});

test('Vesper / Final Draft (Last Revision: the other abilities too) and Cross Reference (Puncture\'s silence as well)',()=>{
  const L=lab(H,S(['rp_1_2','rp_9_2']),{foes:3,big:true}), {v,F}=L; go(L); free(L); kitF(L);
  castLLb(L); castLLb(L); castLLb(L); assert.ok(st(L).e[F[0].uid].corr,'F0 Corrected');
  const f=F[0]; f.greenCd=5; f.blueCd=7;
  press(L,f); secs(0.3);
  near(f.greenCd,5-0.3,'Last Revision: the pressed ability itself is not touched',0.05); near(f.blueCd,7-0.3+0.3*1,'its OTHER abilities take +0.3 x 1 in full (Final Draft is a 1-rank node)',0.05);
  const C=lab(H,S(['rp_2_4','rp_11_1']),{foes:3,big:true}); go(C); free(C); kitF(C);
  const g=C.F[0]; g.greenCd=6; g.blueCd=6; C.F[1].greenCd=6; C.F[1].blueCd=6;
  castP(C); const e=till(()=>g.silencedT>0)*0.0273;   // Puncture's silence lands straight at the cast and Struck Outs each enemy once (Struck Out is a 5-rank node: +1.5)
  near(g.greenCd,6-e+0.3*5,'Cross Reference: the closest-to-ready ability Struck Out by the Puncture silence (a tie: the green)',0.05);
  near(C.F[1].greenCd,6-e+0.3*5,'(every enemy the silence touches)',0.05);
  near(C.F[1].blueCd,6-e,'(the other ability untouched)',0.05);
});

/* ============================== ERRATA'S ROWS ============================== */
test('Vesper / Errata\'s own rows: Narrow Margin, Broad Margin, Long Errata, Caustic Ink, Ink Stain, Quiet Room, Redaction, Strike Through, Safe Shelf',()=>{
  const L=lab(H,S(['rp_2_1','rp_4_1','rp_6_4','rp_8_4','rp_4_4','rp_6_3','rp_7_4','rp_3_4','rp_12_4']),{foes:4,big:true}), {v,F}=L; go(L); free(L);
  near(FX.cd(v,'green',9),9-0.3*3,'Narrow Margin: Errata 0.3 x 3 s shorter (a 3-rank node)');
  const o=FX.kit(v,'erratafield',Object.assign({},v.greenAb));
  near(o.radius,v.greenAb.radius+0.2*3*V.METER,'Broad Margin: the field 0.2 m x 3 wider');
  near(o.dur,v.greenAb.dur+0.2*5,'Long Errata: 5 + 0.2 x 5 s');
  near(o.dps,v.greenAb.dps*1.15,'Caustic Ink: 5% x 3 more damage');
  const f=F[0];
  at(L,f,1,0); castErr(L,f); const hz=VMX('groundHazards').filter(h=>h.src===v)[0]; near(hz.silence,1.5+0.5/V.ccNerf,'the field carries the table 1.5 s + Strike Through 0.5 s in full (raw seconds: the 0.7 lands at write time)',1e-9);
  till(()=>f.silencedT>0); near(f.silencedT,(1.5+0.5/V.ccNerf)*V.ccNerf,'written: (1.5 + 0.5/0.7) x 0.7 = 1.55 s',0.05);
  const p=plainHit(L,()=>myHit(L,f));   /* f stands in the field, silenced */
  near(myHit(L,f),p*Math.pow(1+0.03*3,2),'Quiet Room and Ink Stain: 9% each (a silenced enemy inside her Errata)',1e-9);
  near(myHit(L,F[3]),plainHit(L,()=>myHit(L,F[3])),'off the field and not silenced: neither bonus');
  const A2=lab(H,S(['rp_4_4']),{foes:2,allies:1,big:true}); go(A2); free(A2); freeA(A2);
  at(A2,A2.F[0],1,0); castErr(A2,A2.F[0]);
  const q0=plainHit(A2,()=>allyHit(A2,A2.A[0],A2.F[0],1000));
  near(allyHit(A2,A2.A[0],A2.F[0],1000),q0*1.09,'Ink Stain: her whole team deals 3% x 3 more to an enemy inside her Errata',1e-9);
  /* Redaction (Claude's ruling, 00:49 16 Nov): when the field ends, each enemy still inside gets +0.7 s ON TOP of
     the silence it has (1 x 0.7, minus its control resist, never past the silence ceiling); one with no silence gets the
     plain 0.7 s. The ticks silence the field's own target every 0.52 s (1.05 s each, kept-longer): an enemy the last
     tick touched ends at 1.05 + 0.7; a second foe steps in for the last heartbeat, after the last tick, once the target
     is dead (a live target's body would shove the newcomer out of the radius before the end) */
  const R=lab(H,S(['rp_7_4']),{foes:2,big:true}); go(R); free(R); at(R,R.F[0],0,9); at(R,R.F[1],8,9); castErr(R,R.F[0]);
  secs(4.0); V.hit(R.v,R.F[0],1e10,{kind:'true'});   // the target dies: the field outlives it, sitting where it fell
  till(()=>st(R).hz[0].life<0.3);    // past the last tick (4.93 s), close to the end
  st(R).hz[0].life=0.001;            // pinch the field's life to a heartbeat: no further tick can fire before it ends
  at(R,R.F[1],0,9);   // steps in: only the field's end can silence it now
  till(()=>st(R).hz.length===0);   // the field has ended: the end-add has run
  near(R.F[1].silencedT,0.7,'Redaction: the field\'s end gives a fresh 0.7 s to one the ticks never touched',0.12);
  const R1=lab(H,S(['rp_7_4']),{foes:2,big:true}); go(R1); free(R1); at(R1,R1.F[0],0,9); at(R1,R1.F[1],8,9); castErr(R1,R1.F[0]);
  till(()=>st(R1).hz[0].life<0.3);   // past the last tick, close to the end
  const s0=R1.F[0].silencedT;
  st(R1).hz[0].life=0.001;           // pinch the field's life: no further tick before it ends
  till(()=>st(R1).hz.length===0);   // the field ends
  near(R1.F[0].silencedT,s0+0.7,'Redaction: the field\'s end adds 0.7 s on top of the silence the last tick wrote',0.1);
  const R0=lab(H,null,{foes:2,big:true}); go(R0); free(R0); at(R0,R0.F[0],0,9); at(R0,R0.F[1],8,9); castErr(R0,R0.F[0]);
  secs(4.0); V.hit(R0.v,R0.F[0],1e10,{kind:'true'});
  secs(0.8); at(R0,R0.F[1],0,9); secs(0.35); V.step(2);   // same heartbeat, no Redaction on the plain kit (read while the final-tick silence is still fresh)
  near(R0.F[1].silencedT,1.5*V.ccNerf,'(the base field silences a late-stepper on its own final tick; Redaction is a talent row - untalented it never happens)',0.3);
  /* Safe Shelf: she takes 4% x rank less inside her own field */
  const S2=lab(H,S(['rp_12_4']),{foes:2,big:true}); go(S2); free(S2); at(S2,S2.F[1],0.5,0); at(S2,S2.v,0,0); castErr(S2,S2.F[1]);
  const r0=plainHit(S2,()=>hitOn(S2,1000)); near(hitOn(S2,1000),r0*(1-0.04*3),'Safe Shelf: 12% less inside her own Errata',1e-9);
  at(S2,S2.v,0,9); const r1=plainHit(S2,()=>hitOn(S2,1000)); near(r1,r0,'(step out: it ends)',1e-9);
});

/* ============================== INK AND THE PROOF ============================== */
test('Vesper / Ink: 2 an ability-hit enemy (Loose Leaf counts each enemy once a cast), 30 caps it, Overflowing Ink and Brimming Well raise it',()=>{
  const L=lab(H,S(['sv_1_4']),{foes:3,big:true}), {v,F}=L; go(L); free(L);
  castLL(L); assert.equal(ink(L),6,'Loose Leaf: 2 Ink for each of the 3 enemies it cut (the out pass)');
  castLL(L); assert.equal(ink(L),12,'more casts, more Ink');
  const B=lab(H,S(['sv_1_4','sv_2_4']),{foes:3,big:true}); go(B); free(B); castLL(B); assert.equal(ink(B),15,'Brimming Well: (2 + 1 x 3) an enemy');
  const O=lab(H,S(['sv_1_4','sv_8_4']),{foes:3,big:true}); go(O); free(O);
  for(let i=0;i<5;i++) castLL(O); assert.equal(ink(O),30,'the cap is 30 without Overflowing Ink');
  castLL(O); assert.equal(ink(O),36,'Overflowing Ink: the cap is now 30 + 5 x 3 = 45');
  for(let i=0;i<3;i++) castLL(O); assert.equal(ink(O),45,'and no higher'); castLL(O); assert.equal(ink(O),45,'');
});

test('Vesper / the Proof: at 30 Ink her next basic attack pierces the line through its target for 12% x rank of her AP each (a magic hit), spends the Ink; Blotted, Spilled Ink, Inkfall, Wet Nib, Printer\'s Mark, Halfway Down the Page, Turned Page',()=>{
  const L=lab(H,S(['sv_1_4','sv_3_4','sv_5_4','sv_6_4','sv_n1','sv_n2','sv_9_4']),{foes:3,big:true}), {v,F}=L; go(L); free(L); holdF(L);
  for(const f of F) f.mrRating=0;
  const ap=v.apow;
  const eBase=plainHit(L,()=>{ const e=v.energy; swingAt(L,F[0]); return v.energy-e; });   // a plain swing: the engine's own attack energy + the drip
  for(let i=0;i<5;i++) castLL(L); secs(0.6); assert.equal(ink(L),30,'30 Ink');
  const h=F.map(f=>f.hp);
  const e0=v.energy;
  swingAt(L,F[0]);   /* the Proof fires on the basic attack */
  const d=F.map((f,i)=>h[i]-f.hp); const k=0.12*3*ap;
  assert.ok(d[0]>d[1],'the first enemy takes the most (the basic attack itself plus the pierce; Spilled Ink ramps the line)');
  near(d[1],k*(1+0.03*5),'the second: 12% x 3 of her AP + Spilled Ink 3% x 5 after the first',1e-6*k+0.02);
  near(d[2],d[1],'the third: the line pierces every enemy ahead of her on it',1e-6*k+0.02);
  near(v.energy-e0,eBase+2*3,'Inkfall: 2 energy x 3 from the Proof, on top of what any swing gives',0.3); near(ink(L),2*5,'Wet Nib: she keeps 2 x 5 of the Ink');
  for(const f of F) assert.ok(f.silencedT>0&&f.silencedT<=0.35+1e-9,'Blotted: every pierced enemy silenced, at most the 0.35 s');
  /* Printer's Mark: a kill by the pierce refunds half the spent Ink */
  while(ink(L)<30){ castLL(L); }
  secs(0.6);   // the last Loose Leaf's back pass is spent before the count
  F[0].hp=130; F[0].shield=0;   // sized between the basic attack (~115, lands a beat first) and the pierce (37 x 0.12 x 3 of her AP behind it): the pierce lands the kill
  const before=ink(L); swingAt(L,F[0]); assert.ok(!F[0].alive,'the Proof kills it (the pierce, a beat before the swing lands)');
  assert.equal(ink(L),Math.floor((before-(2*5))/2)+(2*5),'Printer\'s Mark: half of what was spent, on top of what Wet Nib kept');
  /* Halfway Down the Page: the first time an enemy drops below half, 4 Ink a rank */
  F[1].hp=F[1].maxHp*0.6; const i0=ink(L); V.hit(v,F[1],F[1].maxHp*0.15+1,{kind:'true'}); V.step(1);
  assert.equal(ink(L),Math.min(30,i0+4*3),'Halfway Down the Page: +4 x 3 (at the 30 cap)'); V.hit(v,F[1],1,{kind:'true'}); V.step(1); assert.equal(ink(L),Math.min(30,i0+4*3),'(once an enemy)');
  /* Turned Page: an enemy Loose Leaf cut twice gives 1 Ink x rank */
  const T2=lab(H,S(['sv_1_4','sv_9_2']),{foes:3,big:true}); go(T2); free(T2); const j0=ink(T2);
  castLL(T2); secs(0.6); assert.equal(ink(T2),j0+6+1*5*3,'Turned Page: +1 x 5 an enemy the cast cut twice');
});

/* ============================== THE SECOND VERSE ============================== */
test('Vesper / Twice Written: every 3rd ability echoes 1 s later at 10% x rank, damage only (no silence, no cast, no Ink); Chorus: every 2nd; Refrain: sooner; Rhyme, Cold Reading',()=>{
  const L=lab(H,S(['sv_1_1','sv_12_1','sv_2_1','sv_8_1']),{foes:3,big:true}), {v,F}=L; go(L); free(L); holdF(L);
  for(const f of F) f.mrRating=0;
  const h=F.map(f=>f.hp);
  castLLb(L); castLLb(L); assert.equal(st(L).ecN||0,0,'two casts: no echo yet');
  castLL(L); const d3=F.map((f,i)=>h[i]-f.hp);   /* the 3rd: the out pass alone; the echo is armed (Refrain: it lands 1 - 0.2 x 3 = 0.4 s later) */
  const i0=ink(L); till(()=>(st(L).ecN||0)>=1);   /* the return pass and the echo have both landed */
  const d4=F.map((f,i)=>h[i]-f.hp);
  for(let i=0;i<3;i++) near(d4[i]-d3[i],d3[i]*(0.7/1.1+0.10*5*(1+0.05*3)),'the back pass at 70/110 + the echo of the out pass at 10% x 5, + Rhyme 5% x 3',0.03*d3[i]+0.01);
  assert.equal(ink(L),i0,'the echo gives no Ink (damage only)');
  assert.equal(F[0].silencedT||0,0,'and no silence');
  /* Chorus: every 2nd */
  const C=lab(H,S(['sv_1_1','sv_3_1']),{foes:3,big:true}); go(C); free(C);
  castLL(C); assert.equal(st(C).ecN||0,0,'Chorus: the first cast is not an echo'); castLL(C); secs(1.1); assert.equal(st(C).ecN,1,'the second is');
  /* Cold Reading: the echo ignores 4% x rank of the magic resist */
  const M=lab(H,S(['sv_1_1','sv_8_1']),{foes:3,big:true}); go(M); free(M); holdF(M);
  const g=M.F[0]; g.mrRating=400;
  const a=VMX('defMul')(M.v,g,'magic'); g.mrRating=400*0.88; const b=VMX('defMul')(M.v,g,'magic'); g.mrRating=400;
  const h0=g.hp; castLL(M); castLL(M); castLL(M); secs(0.6); const dC=h0-g.hp;   /* out + back of the 3rd (the first two casts' returns were overwritten) */
  secs(0.7); const dA=h0-g.hp;
  const o3=dC/(1+0.7/1.1);
  near(dA-dC,o3*0.5*(b/a),'Cold Reading: the echo ignores 4% x 3 of the magic resist (echo = 10% x 5 of the out pass, at the lighter resist)',0.03*o3+0.01);
});

test('Vesper / Second Verses of Loose Leaf: Bold Type, Verse and Chorus (the echo returns too), Cadence, Margin Rush; Echoing Verse leaves the field longer',()=>{
  const L=lab(H,S(['sv_1_1','sv_8_3','sv_10_1','sv_4_1','sv_11_3']),{foes:3,big:true}), {v,F}=L; go(L); free(L); holdF(L);
  for(const f of F) f.mrRating=0;
  const h=F.map(f=>f.hp);
  v.blueCd=8;
  castLL(L); castLL(L); castLL(L);   /* 3rd: the Loose Leaf Second Verse; three bare outs land, ONE return (the last arming wins) */
  const dOut=F.map((f,i)=>h[i]-f.hp); const k=0.10*5*(1+0.04*5); const cd0=v.blueCd; const o3=dOut.map(x=>x/3);
  const e0=v.energy;
  till(()=>(st(L).ecN||0)>=1);   /* the out-pass echo landed (~1 s: no Refrain here) */
  const dEcho=F.map((f,i)=>h[i]-f.hp);
  for(let i=0;i<3;i++) near(dEcho[i]-dOut[i],o3[i]*(0.7/1.1+k),'the back pass at 70/110 + Bold Type: the echo of the out pass 4% x 5 stronger',0.03);
  near(v.blueCd,8-1.0-1.0,'Cadence: 0.2 x 5 off Loose Leaf\'s cooldown at the echo (a second gone while it ticked)',0.2);
  near(v.energy-e0,1*5+1.0*(v.passMul||1),'Margin Rush: 1 energy x 5 from the Second Verse (plus the drip)',0.4);
  secs(0.5); const dRet=F.map((f,i)=>h[i]-f.hp);   /* Verse and Chorus: the echo comes BACK at the return's own timing */
  for(let i=0;i<3;i++) near(dRet[i]-dEcho[i],o3[i]*(0.7/1.1)*k,'Verse and Chorus: the return pass, echoed at Bold Type',0.03);
  /* Echoing Verse: a Second Verse of Errata leaves the field 0.3 x rank longer */
  const E=lab(H,S(['sv_1_1','sv_7_1']),{foes:2,big:true}); go(E); free(E);
  const x=E.F[0], hx=x.hp; castErr(E,x); castErr(E,x); castErr(E,x); const d1=hx-x.hp; secs(1.1);
  assert.ok(hx-x.hp>d1,'the echoed field ticks too'); assert.ok(x.silencedT===0||x.silencedT<1.5*V.ccNerf,'the echo field is damage only: no silence beyond the real field\'s own');
});

/* ============================== CROSSED ============================== */
test('Vesper / Crossed Lines: an enemy both passes cut is Crossed 4 s (3% x rank of its magic resist ignored by her); Cross Hatch, Torn Sky, Torn Margin',()=>{
  const L=lab(H,S(['sv_4_2','sv_6_2']),{foes:4,big:true}), {v,F}=L; go(L); free(L); holdF(L);
  const f=F[0]; f.mrRating=400; const a=VMX('defMul')(v,f,'magic'); f.mrRating=400*(1-0.03*3); const b=VMX('defMul')(v,f,'magic'); f.mrRating=400;
  castLL(L); secs(0.6); assert.ok(mark(L,f,'vpX'),'Crossed Lines: F0 (both passes) is Crossed');
  assert.ok(!mark(L,F[3],'vpX'),'(not one 6 m off the line)');
  const p=plainHit(L,()=>myHit(L,f));
  near(myHit(L,f),p*(b/a)*(1+0.015*5),'her magic damage ignores 3% x 3 of its magic resist, and her team\'s Cross Hatch: +7.5%',0.02);
  const T2=lab(H,S(['sv_4_2','sv_12_2','sv_11_2']),{foes:3,big:true}); go(T2); free(T2); holdF(T2);
  const g=T2.F[0]; g.mrRating=0; castLL(T2); secs(0.6);   /* g Crossed */
  const h0=g.hp; castP(T2);
  const rs=0.15*3*T2.v.apow; near(h0-g.hp,rs*(1+0.04*5),'Torn Sky: Rift Script 15% x 3 of her AP, +4% x 5 to a Crossed enemy',0.02*rs+0.01);
  /* Torn Margin: the return hits every Crossed enemy, wherever it stands */
  const M=lab(H,S(['sv_4_2','sv_7_2']),{foes:3,big:true}); go(M); free(M); holdF(M);
  const e=M.F[0]; e.mrRating=0; castLL(M); secs(0.6); assert.ok(mark(M,e,'vpX'),'e Crossed');
  at(M,e,0,6);   /* off the line */
  const he=e.hp, h2=M.F[2].hp; castLL(M); secs(0.6);
  assert.ok(e.hp<he,'Torn Margin: the return pass reaches a Crossed enemy 6 m off the lane'); assert.ok(M.F[2].hp<h2,'(and the lane as usual)');
});

/* ============================== LOOSE LEAF'S ROWS ============================== */
test('Vesper / Loose Leaf\'s rows: Copyist\'s Eye, Sharp Pages, Paper Cut, Side Notes, Index, Inkpot, Margin Help, Long Stanza, Twice Torn',()=>{
  const L=lab(H,S(['rp_1_1','sv_1_3','sv_3_3','rp_7_1','rp_6_1','sc_8_3']),{foes:3,big:true}), {v,F}=L; go(L); free(L); holdF(L);
  for(const f of F) f.mrRating=0;
  const hp0=F.map(f=>f.hp);
  const dPO=plainHit(L,()=>{ castLL(L); return F.map((f,i)=>hp0[i]-f.hp); });   // the plain out pass on this field
  const dPB=plainHit(L,()=>{ const a=F.map(f=>f.hp); castLL(L); secs(0.6); return F.map((f,i)=>a[i]-f.hp); });   // the plain out + back
  const hp1=F.map(f=>f.hp);
  castLL(L); const dTO=F.map((f,i)=>hp1[i]-f.hp);   // her talented out pass
  secs(0.6); const dTB=F.map((f,i)=>hp1[i]-f.hp);   // + her talented back pass
  for(let i=0;i<3;i++) near(dTO[i],dPO[i]*(1+0.03*3+0.02*5),'out pass: Copyist\'s Eye 3% x 3 + Sharp Pages 2% x 5 (one added pool: 19%)',0.03);
  for(let i=0;i<3;i++) near(dTB[i]-dTO[i],(dPB[i]-dPO[i])*(1+0.03*3+0.02*5)*(1+0.04*5),'back pass: the same 19% + Paper Cut +4% x 5',0.06);
  near(FX.cd(v,'blue',8),8-0.3*3-0.15*5,'Index and Inkpot: Loose Leaf 0.9 + 0.75 s shorter (to 6.35)');
  const o=FX.kit(v,'pagestorm',Object.assign({},v.blueAb));
  near(o.width,v.blueAb.width*1.10,'Side Notes: 2% x 5 wider');
  const M=lab(H,S(['sc_10_2']),{foes:3,allies:2,big:true}); go(M); free(M); freeA(M);
  at(M,M.A[0],5,0.5); at(M,M.A[1],0,9);   // A0 on the page line, A1 well off it
  const a0=M.A.map(a=>a.energy); castLL(M);
  near(M.A[0].energy-a0[0],1*5,'Margin Help: an ally the pages pass gains 1 x 5 energy',0.01);
  assert.ok(M.A[1].energy-a0[1]<0.01,'(an ally off the line: nothing)');
  const G=lab(H,S(['sv_5_3']),{foes:3,big:true}); go(G); free(G);
  const og=FX.kit(G.v,'pagestorm',Object.assign({},G.v.blueAb));
  near(og.width,G.v.blueAb.width*1.3,'Long Stanza: 30% wider');
  assert.ok(og.reach>=3*V.METER-0.01,'Long Stanza: the kit gains +3 m of reach (o.reach, engine units; the base pagestorm kit carries none)');
  const T=lab(H,S(['sv_5_2']),{foes:3,big:true}); go(T); free(T); holdF(T);
  for(const f of T.F) f.mrRating=0;
  const th=T.F.map(f=>f.hp); castLL(T); const tO=T.F.map((f,i)=>th[i]-f.hp); secs(0.6); const t1=T.F.map((f,i)=>th[i]-f.hp); secs(0.6);
  const t2=T.F.map((f,i)=>th[i]-f.hp);
  for(let i=0;i<3;i++) near(t2[i]-t1[i],(t1[i]-tO[i])*0.5,'Twice Torn: the pages come back a second time at 50% of the back pass',0.06);
});

/* ============================== HER ABILITY ROWS ============================== */
test('Vesper / Steady Nib (a Note), Early Verse (above 70%), Unfinished (below 40%)',()=>{
  const L=lab(H,S(['rp_1_3','sv_7_3','sv_9_3','rp_1_2']),{foes:3,big:true}), {v,F}=L; go(L); free(L); holdF(L);
  for(const f of F) f.mrRating=0;
  at(L,F[1],0,4); at(L,F[2],0,-4);   // only F0 on the line (it stays the farthest, on y = 0): its out pass is the whole of Loose Leaf
  const f=F[0];
  castLLb(L);   /* one Note on f */
  const pO=plainHit(L,()=>{ const h=f.hp; castLL(L); return h-f.hp; });   // the plain out pass on it
  const h1=f.hp; castLL(L); const tO=h1-f.hp;
  near(tO,pO*(1+0.02*5)*(1+0.02*5),'at full HP: Steady Nib +2% x 5 (a Note on it) and Early Verse +2% x 5 (above 70%)',0.03);
  f.hp=f.maxHp*0.3; const h2=f.hp; castLL(L); const t2=h2-f.hp;
  near(t2,pO*(1+0.02*5)*(1+0.02*5),'below 40%: Unfinished\'s +2% x 5 instead (the same total)',0.03);
});

/* ============================== THE DEADLINE ============================== */
test('Vesper / Press Date: every 10 s the ally with the least ultimate energy gains 4 x rank (Scriptorium\'s own drip comes on top); Early Deadline, Late Shift, Overtime, Closing Hour',()=>{
  const L=lab(H,S(['sc_1_1']),{foes:2,allies:2,big:true}), {v,A}=L; go(L); free(L); freeA(L);
  A[0].energy=10; A[1].energy=0; const p=v.passMul||1;
  secs(10.1);
  near(A[1].energy,0+4*5+10.1*p,'Press Date: the least-energy ally gains 4 x 5',0.5);
  near(A[0].energy,10+10.1*p,'the other ally: only Scriptorium',0.4);
  const E=lab(H,S(['sc_1_1','sc_2_1']),{foes:2,allies:1,big:true}); go(E); free(E); freeA(E);
  secs(8.6); near(E.A[0].energy,0+4*5+8.6*(E.v.passMul||1),'Early Deadline: the first Deadline at 10 - 0.5 x 3 = 8.5 s',0.4);
  const N=lab(H,S(['sc_1_1','sc_3_1']),{foes:2,allies:2,big:true}); go(N); free(N); freeA(N);
  N.A[0].energy=0; N.A[1].energy=0; secs(10.1);
  assert.ok(N.A[0].energy>19||N.A[1].energy>19,'one ally received the Deadline');
  const got=N.A[0].energy>N.A[1].energy?0:1, other=1-got;
  near(N.A[other].energy,0+3,'Late Shift: every OTHER ally gains 3',10.1*(N.v.passMul||1)+0.4);
  const O=lab(H,S(['sc_1_1','sc_12_1']),{foes:2,allies:1,big:true}); go(O); free(O); freeA(O);
  O.A[0].energy=60; secs(10.1); near(O.A[0].energy,60+4*5+1*3,'Overtime: an ally at least half full gains 1 x 3 more',10.1*(O.v.passMul||1)+0.4);
  const C=lab(H,S(['sc_10_1','sc_1_1']),{foes:2,allies:1,big:true}); go(C);
  assert.equal(st(C).dlN,1,'Closing Hour: the first Deadline of the wave passes at once');
});

test('Vesper / Deadline, the marks and the overflow: Urgent Order, All Hands, Collected Works, Late Lamp, Carried Over',()=>{
  const L=lab(H,S(['sc_1_1','sc_7_1']),{foes:2,allies:2,big:true}), {v,A}=L; go(L); free(L); freeA(L);
  A[0].energy=0; A[1].energy=0; A[1].hp=A[1].maxHp*0.3;
  secs(10.1); assert.ok(A[1].energy>19,'Urgent Order: an ally at 30% HP counts as having the least energy (chosen over the 0-energy one at full HP)');
  const H2=lab(H,S(['sc_1_1','sc_9_1']),{foes:2,allies:1,big:true}); go(H2); free(H2); freeA(H2);
  const a0=H2.A[0].apow; secs(10.1); near(H2.A[0].apow,a0*1.05,'All Hands: the chosen ally +1% x 5 ability power for 5 s',0.001);
  const W=lab(H,S(['sc_1_1','sc_6_1']),{foes:2,allies:1,big:true}); go(W); free(W); freeA(W);
  secs(10.1); const w=W.A[0];
  const r0=plainHit(W,()=>foeHit(W,w,1000));
  near(foeHit(W,w,1000),r0*(1-0.02*3),'Collected Works: the chosen ally takes 6% less for 4 s',1e-9);
  const LL=lab(H,S(['sc_1_1','sc_4_1']),{foes:2,allies:1,big:true}); go(LL); free(LL); freeA(LL);
  const x=LL.A[0]; at(LL,x,2,0); const g=LL.F[0]; at(LL,g,2,0); g.mrRating=0;
  secs(10.1);
  const q0=plainHit(LL,()=>allyHit(LL,x,g,1000)); near(allyHit(LL,x,g,1000),q0*1.05,'Late Lamp: after a Deadline the ally deals 1% x 5 more for 4 s',1e-9);
  const CO=lab(H,S(['sc_1_1','sc_n1']),{foes:2,allies:2,big:true}); go(CO); free(CO); freeA(CO);
  CO.A[0].energy=95; CO.A[1].energy=0; secs(10.1);
  near(CO.A[0].energy,100,'the chosen ally fills to 100 (5 of 20 used)',10.1*(CO.v.passMul||1)+0.3);
  near(CO.A[1].energy,0+Math.min(10,(20-5)*0.3*3),'Carried Over: 30% x 3 of the overflow (capped at 10) to the next-least ally',10.1*(CO.v.passMul||1)+0.4);
});

/* ============================== PROOFREAD ============================== */
test('Vesper / Proofread: allies inside her Errata take crowd control 5% x rank shorter (Binding Glue lingers, Desk Leather armor, Second Proof damage cut, Clear Copy on entry, Study Hall heal)',()=>{
  const L=lab(H,S(['sc_1_4','sc_3_4','sc_7_4','sc_3_3','sc_2_4','sc_7_3']),{foes:2,allies:1,big:true}), {v,A,F}=L; go(L); free(L); freeA(L); holdF(L);   // held: the field follows its target - a drifting foe would carry it out of the test spots
  const a=A[0]; at(L,a,0,9); const arm0=a.armorRating;   // outside the field for now
  castErr(L,F[0]); secs(0.6);
  at(L,a,1,0); V.step(3);   // steps in: Proofread
  till(()=>a.armorRating>arm0); near(a.armorRating,arm0*(1+0.02*3),'Desk Leather: +2% x 3 armor while Proofread',0.001);
  V.cc(F[0],a,'stunned',2); near(a.stunned,2*V.ccNerf*(1-0.05*3),'Proofread: a control on it lasts 5% x 3 shorter',1e-9);
  const r0=plainHit(L,()=>foeHit(L,a,1000));
  near(foeHit(L,a,1000),r0*(1-0.02*3),'Second Proof: 2% x 3 less damage while Proofread',1e-9);
  const h0=a.hp; secs(1.05); assert.ok(a.hp>h0,'Study Hall: 1% of max HP a second inside the field');
  /* Clear Copy: a control is removed the moment it steps in (once every 8 s). Dedicated field with the target dead: a live
     target's body shoves the ally (and the field gets shoved with it), a corpse cannot */
  const C2=lab(H,S(['sc_1_4','sc_3_4','sc_7_4']),{foes:2,allies:1,big:true}); go(C2); free(C2); freeA(C2);
  const c=C2.A[0]; at(C2,C2.F[1],20,20); C2.F[1].stunned=1e6;   // a far anchor: killing the field's target must not end the fight
  castErr(C2,C2.F[0]); secs(0.3);
  V.hit(C2.v,C2.F[0],1e10,{kind:'true'}); V.step(1);
  at(C2,c,0,9); V.step(3);   // well outside
  V.cc(C2.F[0],c,'stunned',2); assert.ok(c.stunned>0,'(a control lands on it outside)');
  at(C2,c,4.5,0); let n=0; while(c.stunned>0&&n<30){ V.step(1); n++; }
  assert.ok(c.stunned===0&&n<30,'Clear Copy: stepping in with a control dispels it ('+n+' steps, long before 1.4 s of decay)');
  V.cc(C2.F[0],c,'stunned',2); near(c.stunned,2*V.ccNerf*(1-0.05*3),'(the 8 s cooldown: a second control inside is not dispelled, but Proofread still shortens it)',1e-9);
  /* Binding Glue: Proofread lingers 0.4 x rank after leaving */
  const B=lab(H,S(['sc_1_4','sc_7_4']),{foes:2,allies:1,big:true}); go(B); free(B); freeA(B);
  const b=B.A[0]; at(B,b,1,0); castErr(B,b); secs(0.6); at(B,b,0,9); V.cc(B.F[0],b,'stunned',2);
  near(b.stunned,2*V.ccNerf*(1-0.05*3),'Binding Glue: still shorter 0.4 x 5 s after it left the field',1e-9);
  secs(3.0); V.cc(B.F[0],b,'stunned',2); near(b.stunned,2*V.ccNerf,'(3 s later: the linger is over)',1e-9);
});

test('Vesper / Unrushed: crowd control on her 4% x rank shorter (at most 20%)',()=>{
  const L=lab(H,S(['sc_3_2']),{foes:2,big:true}), {v,F}=L; go(L); free(L);
  F[0].level=100;   // the lab foes are level 1: their control on her (level 100) would bounce off - meet her at her own level
  V.cc(F[0],v,'stunned',2); near(v.stunned,2*V.ccNerf*(1-0.04*5),'a control on her: 4% x 5 shorter',1e-9);
  const P=lab(H,null,{foes:2,big:true}); go(P); free(P); P.F[0].level=100;
  V.cc(P.F[0],P.v,'stunned',2); near(P.v.stunned,2*V.ccNerf,'(plain: the full 0.7-scaled stun)',1e-9);
});

/* ============================== FAIR COPY ============================== */
test('Vesper / True Copy: an ally\'s ultimate makes Scriptorium run three times as fast for the rest of the team for 0.8 s x rank; Copy Desk, Shared Desk, Head Copyist, Illuminated, Long Shift, Gilded Edge, Busy Desks',()=>{
  const L=lab(H,S(['sc_4_2','sc_8_2','sc_5_2','sc_5_3','sc_2_3','sc_11_2']),{foes:2,allies:2,big:true}), {v,A,F}=L; go(L); free(L); freeA(L);
  const a=A[0], b=A[1]; at(L,a,0,-5.5); at(L,b,0,-11); const p=v.passMul||1;
  const e0=b.energy; secs(1.0); const rate0=(b.energy-e0)/1.0;
  near(rate0,p*(1+0.02*5),'Busy Desks: Scriptorium 2% x 5 faster',0.06);
  a.greenCd=5; a.blueCd=7; const ve0=v.energy, ap0=v.apow;
  V.cast(a,'ult',a);   /* the ally's ultimate: a Fair Copy (0.8 x 3 + 0.2 x 3 = 3.0 s) */
  near(a.greenCd,4,'Shared Desk: 1 s off every ability\'s cooldowns',0.01); near(a.blueCd,6,'',0.01);
  const e1=b.energy; secs(0.5); const rate1=(b.energy-e1)/0.5;
  near(rate1,p*(1+0.02*5)*3,'True Copy + Copy Desk: three times as fast for the rest of the team (the ally who cast is excluded)',0.12);
  assert.ok(v.energy>ve0+9,'Head Copyist: Vesper gains 10 energy from the copy');
  V.cast(b,'ult',b); V.step(2);
  near(v.apow,ap0*(1+0.01*T.talent(H,'sc_11_2').ranks*2),'Long Shift: her ability power +1% x rank a Fair Copy, two have run (restated on the talent tick)',0.001);
  /* Illuminated: allies' abilities deal 10% more while a copy runs */
  const I=lab(H,S(['sc_4_2','sc_9_2']),{foes:2,allies:1,big:true}); go(I); free(I); freeA(I);
  const x=I.A[0]; at(I,x,2,0); const g=I.F[0]; at(I,g,2,0); g.mrRating=0;
  V.cast(x,'ult',x);
  const q0=plainHit(I,()=>allyHit(I,x,g,1000)); near(allyHit(I,x,g,1000),q0*1.10,'Illuminated: 10% more ability damage while the copy runs',1e-9);
  /* Gilded Edge: attack speed 0.2% x rank per ultimate used this fight (up to 5) */
  const G=lab(H,S(['sc_6_2']),{foes:2,allies:1,big:true}); go(G); free(G); freeA(G);
  const y=G.A[0]; const iv0=y.atkInterval;
  V.cast(y,'ult',y); V.step(2); const iv1=y.atkInterval;   // the restat runs on the talent tick
  near(iv0/iv1,1+0.002*5*1,'Gilded Edge: one ultimate used, +0.2% x 5 attack speed',0.001);
});

/* ============================== PUNCTURE'S ROWS ============================== */
test('Vesper / Eleven Errors: the freeze 0.1 s x rank longer in full, under the 4.0 s caps; Margin of Error and Annotated Rift: the silence longer in full, never past freeze-end + 4 s',()=>{
  const L=lab(H,S(['rp_10_3','rp_11_3','sc_12_3']),{foes:3,big:true}), {v,F}=L; go(L); free(L);
  const f=F[0];
  castP(L);
  const fd=f.stunned; near(fd,3*V.ccNerf+0.1*3,'Eleven Errors: 2.1 + 0.3 s, in full',0.02);
  const s0=f.silencedT;
  assert.ok(s0>V.cap('silencedT'),'Margin of Error + Annotated Rift: +0.5 + 0.5 s in full on top of the capped base');
  assert.ok(s0<=fd+4.0+1e-9,'never past freeze-end + 4.0');
  secs(fd+0.1); const s1=f.silencedT;
  near(s1,s0-fd-0.1,'after the freeze: the extended silence still runs',0.08);
  assert.ok(s1>1.0,'more than the plain 1.75 s - the extensions are real time past the freeze');
  const M=lab(H,null,{foes:3,big:true}); go(M); free(M);
  castP(M); near(M.F[0].silencedT,V.cap('silencedT'),'(plain: the 3.85 s base, no extensions)',0.02);
});

test('Vesper / Puncture Proof, For the Record',()=>{
  const L=lab(H,S(['sc_10_3']),{foes:2,allies:1,big:true}), {v,A}=L; go(L); free(L); freeA(L);
  const a=A[0]; castP(L);
  const r0=plainHit(L,()=>foeHit(L,a,1000));
  near(foeHit(L,a,1000),r0*(1-0.01*5),'Puncture Proof: allies take 5% less for 4 s after Puncture',1e-9);
  const F=lab(H,S(['rp_n3']),{foes:2,big:true}); go(F); free(F);
  const f=F.F[0]; f.level=200;   // nineteen levels above her skill: her control cannot land (Puncture carries no (1 - ctrlRes) factor - the level gap is the cover)
  castP(F); assert.ok(!(f.silencedT>0),'(its level gap resists the silence)'); assert.ok(!(f.stunned>0),'(the freeze too)');
  const p0=plainHit(F,()=>hitOn(F,1000,{src:f}));
  near(hitOn(F,1000,{src:f}),p0*(1-0.05*3),'For the Record: a silence that could not land makes it deal 15% less for 3 s instead',1e-9);
  near(hitOn(F,1000,{src:F.F[1]}),plainHit(F,()=>hitOn(F,1000,{src:F.F[1]})),'(the other enemy: no such mark)');
});

/* ============================== THE SIGNATURES ============================== */
test('Vesper / The True Version: every frozen enemy gains 3 Notes and is Corrected when the freeze ends; for 6 s an enemy Green or Blue cast inside Errata fails (once an enemy, on top of the Correction)',()=>{
  const L=lab(H,S(['rp_13_3']),{foes:3,big:true}), {v,F}=L; go(L); free(L);
  at(L,F[0],1,0); castErr(L,F[0]);   /* a field on F0's spot */
  castP(L);
  assert.equal(ust(L,F[0],'vpN'),0,'(not yet: the Notes come when the freeze ends)');
  secs(3*V.ccNerf+0.1);
  assert.equal(ust(L,F[0],'vpN'),0,'the freeze ended: 3 Notes arrived and cleared - Corrected'); assert.ok(st(L).e[F[0].uid].corr,'');
  at(L,F[1],1.5,0);   /* F1 stands in the field too */
  F[1].silencedT=0; press(L,F[1]);
  for(let i=0;i<25;i++){ F[1].silencedT=0; V.step(1); }   // the field re-silences every tick: keep it clear so a resolution is possible
  assert.equal(F[1]._pend,null,'inside Errata in the window: the cast fails'); assert.equal(F[1].__fired,0,'');
  F[1].silencedT=0; press(L,F[1]);
  for(let i=0;i<25;i++){ F[1].silencedT=0; V.step(1); }
  assert.equal(F[1]._pend,null,'(the True Version window fails the next one too: Correction and the window are each once an enemy)'); assert.equal(F[1].__fired,0,'');
  F[1].silencedT=0; press(L,F[1]);
  for(let i=0;i<25;i++){ F[1].silencedT=0; V.step(1); }
  assert.equal(F[1].__fired,1,'(both onces spent: the third press resolves)');
});

test('Vesper / The Unprinted Verse: for 6 s every ability she casts is a Second Verse at full damage, every frozen enemy is Crossed, her Ink fills to 30; the echo is damage only',()=>{
  const L=lab(H,S(['sv_13_2']),{foes:3,big:true}), {v,F}=L; go(L); free(L); holdF(L);
  for(const f of F) f.mrRating=0;
  assert.equal(ink(L),0,''); castP(L);
  assert.equal(ink(L),30,'her Ink fills to 30 at once');
  assert.ok(mark(L,F[0],'vpX')&&mark(L,F[2],'vpX'),'every enemy Puncture froze is Crossed');
  const h=F.map(f=>f.hp); castLL(L); const d1=F.map((f,i)=>h[i]-f.hp);
  secs(1.1); const d2=F.map((f,i)=>h[i]-f.hp);
  for(let i=0;i<3;i++) near(d2[i]-d1[i],d1[i]*(0.7/1.1+1.0),'the back pass at 70/110 + a full-damage Second Verse of the out pass (100%, not 10% a rank)',0.03);
  secs(5.0); const d3=F.map((f,i)=>h[i]-f.hp); for(let i=0;i<3;i++) assert.ok(d3[i]-d2[i]<1e-6,'the window is 6 s: nothing more echoes');
  castErr(L,F[0]); const e1=v.energy; secs(1.1); near(v.energy-e1,1.1*(v.passMul||1),'the echo gives no energy (only the Scriptorium drip runs)',0.3);
});

test('Vesper / The Fourth Year: Puncture gives every ally 20 energy and Proofread for 6 s; the next ally ultimate makes a Fair Copy twice as long that then copies 30% of its damage onto the enemy nearest Vesper (damage only)',()=>{
  const L=lab(H,S(['sc_13_3','sc_1_4']),{foes:2,allies:2,big:true}), {v,A,F}=L; go(L); free(L); freeA(L);
  castP(L);
  for(const a of A) near(a.energy,20,'every ally gains 20 ultimate energy',(v.passMul||1)*0.1+0.3);
  const a=A[0]; at(L,a,0,-5.5);
  V.step(3);   // the Proofread status rebuilds on the talent tick
  /* proofread for 6 s anywhere (The Fourth Year's mark): sc_1_4 adds the percentage - the signature only grants the status */
  V.cc(F[0],a,'stunned',2); near(a.stunned,2*V.ccNerf*(1-0.05*3),'and is Proofread at once (a control on it is 15% shorter)',0.02);
  /* the flagged ultimate */
  const e1=A[1].energy; V.cast(a,'ult',a);
  secs(0.5); const rate=(A[1].energy-e1)/0.5;
  assert.ok(rate>2.5*(v.passMul||1),'the Fair Copy runs at least twice as long (a 2.4 s window for the team)');
  const n0=F[0].hp; V.hit(a,F[0],400,{kind:'magic'});   /* the flagged ally's ultimate is on the books */
  const raw=n0-F[0].hp;   // the ally's own hit, with her team's multipliers on it (that is what the copy counts)
  secs(2.0);   /* the copy lands 2 s after the ultimate */
  const dealt=n0-F[0].hp;
  near(dealt,raw*1.30,'the copy strikes the enemy nearest Vesper (F0): the hit plus 30% of its dealt amount copied, damage only ('+dealt.toFixed(1)+' vs '+(raw*1.30).toFixed(1)+' expected)',0.02);
});

/* ============================== THE CAPS ============================== */
test('Vesper / her damage-reduction group: everything that can be true at once still leaves at least 70% of a hit on her (30% off, the floor)',()=>{
  const I=lab(H,S(['rp_11_4','rp_12_4','sv_3_2','sv_1_4']),{foes:3,big:true}); go(I); free(I); holdF(I); freeA0(I);
  const g=I.F[0]; g.mrRating=0; g.silencedT=9;   /* Leather Bound's condition */
  at(I,g,0.5,0); at(I,I.v,0,0); castErr(I,g);   /* her own field under her (Safe Shelf) */
  for(let i=0;i<5;i++) castLL(I); assert.equal(ink(I),30,'30 Ink (Margin Weight)');
  const p0=plainHit(I,()=>hitOn(I,1000,{src:g}));
  const k=0.925*0.88*0.91;   /* Leather Bound 1.5% x 5 vs a silenced attacker, Safe Shelf 4% x 3, Margin Weight 0.1% x 3 x 30 - the product alone */
  const hit=hitOn(I,1000,{src:g});
  near(hit/p0,Math.max(0.70,k),'Leather Bound + Safe Shelf + Margin Weight: 0.925 x 0.88 x 0.91 = 0.741 - above the 0.70 floor',0.02);
});
function freeA0(L){ for(const a of L.A){ a.stunned=1e6; } }

test('Vesper / her allies\' damage-reduction group: Second Proof + Collected Works + Puncture Proof multiply to 0.94 x 0.94 x 0.95 (floor 0.75)',()=>{
  const W=lab(H,S(['sc_2_4','sc_6_1','sc_10_3','sc_1_1']),{foes:2,allies:1,big:true}); go(W); free(W); freeA(W);
  const w=W.A[0]; at(W,w,1,0); castErr(W,w); secs(10.1); castErr(W,w); castP(W); V.step(3);   /* the first field died at 5 s: a fresh one for the Proofread; the status rebuilds on the tick */
  const r0=plainHit(W,()=>foeHit(W,w,1000));
  near(foeHit(W,w,1000),r0*0.94*0.94*0.95,'Proofread (Second Proof 2% x 3) x the Deadline mark (Collected Works 2% x 3) x Puncture Proof 1% x 5 - the 25% floor not reached',0.02);
});

test('Vesper / her freezes: never more than 4.0 s of stun in a row on one enemy, then 0.5 s free of them',()=>{
  const L=lab(H,S(['rp_10_3']),{foes:3,big:true}), {v,F}=L; go(L); free(L);
  const f=F[0];
  castP(L); near(f.stunned,3*V.ccNerf+0.1*3,'the first freeze: 2.1 + 0.3 in full',0.02);
  secs(1.0); castP(L);   /* a second freeze 1 s into the run */
  near(f.stunned,2.4,'refreshed to a full 2.4 s (the run is 3.4 s, still under 4.0)',0.02);
  secs(1.0); castP(L);
  near(f.stunned,2.0,'a third: the run cap bites (RUN_TOP - the resisted time already served)',0.06);
  const left=f.stunned; secs(left+0.05);
  assert.ok(!(f.stunned>0.01),'the run reached its end: it stops');
  castP(L); assert.ok(!(f.stunned>0.01),'a freeze inside the 0.5 s free window does not land');
  secs(0.6); castP(L); near(f.stunned,2.4,'(0.5 s later it freezes again)',0.02);
});

test('Vesper: whole fights are deterministic with any build, and with no talents she plays exactly her plain kit',()=>{
  determinism(H,TEAM);
  const B=lab(H,S(['rp_1_1','sv_1_1','sc_1_1']),{foes:3,big:true}), {v,F}=B; go(B); free(B); holdF(B);
  for(const f of F) f.mrRating=0;
  const h0=F.map(f=>f.hp);
  const dP=plainHit(B,()=>{ const a=F.map(f=>f.hp); castLL(B); return F.map((f,i)=>a[i]-f.hp); });   // the same field, her talents off
  const h1=F.map(f=>f.hp);
  castLL(B);   // the talented out pass
  const dT=F.map((f,i)=>h1[i]-f.hp);
  for(let i=0;i<3;i++) near(dT[i],dP[i]*(1+0.03*3),'with the damage talents off, her numbers are the plain kit\'s (Copyist\'s Eye multiplies on top)',0.02);
  assert.equal(st(B).q.length,0,'and no Second Verse fires untalented');
});

/* Phil, 15 Nov: nobody ever above 95% damage reduction. Vesper's reductions are one capped group on her (30% floor) and one on
   her allies (25% floor); her base kit has no damage reduction at all. The most defensive legal build is checked at its worst
   possible moment - every DR talent's condition true at once - with and without the 30% glyph cap; then a seeded-fight monitor
   watches every hit on her. */
const DEF={ rp:['rp_11_4','rp_12_4','rp_7_2','rp_9_1','rp_n3','rp_1_2'], sv:['sv_3_2','sv_11_4'], sc:['sc_3_2','sc_8_4','sc_11_4'] };
function deep(order,caps,want){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={rp:0,sv:1,sc:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of want[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
function lab100(list){ const al=[Object.assign(spec(H,100,list),{skillLv:[100,100,100,100]})].concat([0,1,2,3].map(()=>spec('vael',100,null,0)));
  const U=V.arena(snaps(al),snaps([0,1,2,3].map(()=>spec('vael',100,null,0))),7), v=U[0], F=U.filter(u=>u.team==='enemy');
  for(const u of U){ u.stunned=1e6; u.evaStat=0; u.blockStat=0; u.glyphCrit=0; u.glyphRegen=0; u.energyReg=0; u.energy=0; u.ctrlRes=0; u.ctrlHitF=0; u.glyphDR=0; if(u!==v){ u.maxHp=u.hp=1e9; } }
  v.x=300; v.y=700; F.forEach((f,i)=>{ f.x=v.x+[4.5,10,15.5,0][i]*V.METER; f.y=v.y+[0,0,0,6][i]*V.METER; });
  V.step(1); return {v,F,T:v._tal}; }
test('Vesper: her most defensive legal 91-point build never takes 95% off a hit, its worst hit stays under 90%, and she is at 85% or more for well under half a fight',()=>{
  const cands=[[['rp','sv'],[61,30]],[['rp','sc'],[61,30]],[['sv','rp'],[61,30]],[['sv','sc'],[61,30]],[['sc','rp'],[61,30]],[['sc','sv'],[61,30]],[['rp'],[91]],[['sv'],[91]],[['sc'],[91]],[['rp','sv','sc'],null]]
    .map(([o,c])=>{ const b=deep(o,c,DEF); const bad=T.invalid(H,b,100); assert.equal(bad,'','a legal build: '+bad); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=Math.max(worstHit(c.list,0,'magic'),worstHit(c.list,0,'phys')); c.worstG=Math.max(worstHit(c.list,0.30,'magic'),worstHit(c.list,0.30,'phys')); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(worstHit(null,0,'magic'),worstHit(null,0,'phys')), noneG=Math.max(worstHit(null,0.30,'magic'),worstHit(null,0.30,'phys'));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+(c.worst*100).toFixed(1)+'% ('+(c.worstG*100).toFixed(1)+'% with glyphs)').join(' | '));
  assert.ok(best.worst>none+0.03,'(the talents do reduce it: '+(best.worst*100).toFixed(1)+'% against '+(none*100).toFixed(1)+'% with none)');
  assert.ok(best.worst<0.90,'the worst possible hit on her most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 90%');
  assert.ok(Math.max(...cands.map(c=>c.worstG))<0.95,'with 30% glyph reduction too: below 95% ('+(Math.max(...cands.map(c=>c.worstG))*100).toFixed(1)+'%)');
  console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%); with 30% glyphs '+(best.worstG*100).toFixed(1)+'% (no talents '+(noneG*100).toFixed(1)+'%)');
});
/* the worst hit on her: every condition of her damage-reduction talents true at once - she stands in her own Errata, the
   attacker is silenced and carries 3 Notes, Correction, Errant Hand and For the Record marks, her Ink is at its cap; physical
   and magic; and again with glyph damage reduction at its 30% cap. */
function worstHit(list,glyph,kind){ const L=lab100(list), {v,F}=L, f=F[0];
  v.maxHp=1e6; v.hp=0.6*v.maxHp; v.shield=0; v.glyphDR=glyph||0; f.mrRating=0; f.armorRating=0;
  if(L.T){ const W=L.T.s.vp;
    W.e[f.uid]=Object.assign(W.e[f.uid]||{u:f},{lock:0,corr:0,pd:null,fr:0,st:0,re:0,cap:0,tvz:0,tvF:0,hd:0});
    f.silencedT=9;
    /* the marks: 3 Notes (vpN), Proof Copy (vpPC), Errant Hand (vpEH), For the Record (vpFR) */
    const put=(n,val,d)=>{ f._talM=f._talM||{}; const o=f._talM[v.uid]=f._talM[v.uid]||{}; o[n]={v:val,until:V.now()+d}; };
    put('#vpN',3,9); put('vpPC',1,9); put('vpEH',1,9); put('vpFR',1,9);
    /* 30 Ink */
    const k=L.T.s.k; k['vpInk']=Object.assign(k['vpInk']||{},{n:30,t:99,idle:0});
    /* her own field under her (Safe Shelf): an enemy at her feet catches it */
    f.x=v.x; f.y=v.y; V.cast(v,'green',f);
    W.hz=VMX('groundHazards').filter(h=>h.src===v);
  }
  const raw=1e5, h0=v.hp; V.hit(f,v,raw,{kind:kind==='phys'?'phys':'magic'}); const x=h0-v.hp;
  return 1-x/(raw*VMX('elemMul')(f,v)); }
