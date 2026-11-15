'use strict';
/* Linnet's talents as data on the mechanics layer (talents-mech/linnet.js), group by group on the still field (tests/talents-lab.js), then whole fights,
   the no-talent identity of the page sites her talents added, Phil's 95% damage-reduction ceiling.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured in a plain lab built BEFORE
   the talented one (lab() replaces the whole field), or with her talents switched off for one hit (plainHit).
   ll(): the lab with 3 allies (A0..A2, rank-0 Vaels, max HP 1e5, full) and 3 foes, everyone held. Her skills at skill level 10 (x1.108); her passive
   Golden Thread at level 10 (x1.108). The thread runs to the ally with the lowest HP share (the page's passive loop, every tick, held or not).
   Run: node --test tests/talents-mech-linnet.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='linnet', S=ids=>full(H,ids);
const TMP=[]; test.after(()=>{ for(const d of TMP) try{ fs.rmSync(d,{recursive:true,force:true}); }catch(e){} });
test.afterEach(()=>{ FX.define(H,null); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const VMX=s=>vm.runInContext(s,NOW.ctx);
const SM=()=>VMX('skillMul')(10);
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const ln=L=>L.T.s.ln||(L.T.s.ln={});
const ust=(L,t,name)=>{ const o=t._talM&&t._talM[L.v.uid], m=o&&o['#'+name]; return (m&&V.now()<m.until)?m.v:0; };
const ustLeft=(L,t,name)=>{ const o=t._talM&&t._talM[L.v.uid], m=o&&o['#'+name]; return m?m.until-V.now():0; };
const setUst=(L,t,name,n,d)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o['#'+name]={v:n,until:V.now()+(d||99)}; };
const mk=(L,t,name)=>{ const o=t._talM&&t._talM[L.v.uid], m=o&&o[name]; return !!m&&(m.until==null||m.until>V.now()); };
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
/* the lab: Linnet with big HP when asked (o.big), 3 allies at 1e5 max HP (full), 3 foes */
function ll(list,o){ o=o||{}; const L=lab(H,list,Object.assign({allies:3,foes:3},o,{cold:true}));
  for(const a of L.A){ a.maxHp=1e5; a.hp=1e5; } if(o.big){ L.v.maxHp=1e5; L.v.hp=1e5; } if(o.pre) o.pre(L); V.step(1); if(L.T){ ln(L).bud=1e12; } return L; }
const gain=(x,fn)=>{ const h=x.hp; fn(); return x.hp-h; };
const hitOn=(L,x,amt,o)=>{ const r=lost(x,()=>V.hit(o&&o.src||L.F[0],x,amt,Object.assign({kind:'true'},o||{}))); return r; };
const low=(L,x,f)=>{ for(const a of L.A) a.hp=a.maxHp; x.hp=x.maxHp*f; };   // x the most wounded ally (the thread, Mending Stitch, Reinforced Seam go to it)
const green=L=>V.cast(L.v,'green'), blue=L=>V.cast(L.v,'blue'), ult=L=>V.cast(L.v,'ult');
const burst=(L,x)=>{ return gain(x,()=>green(L)); };
const hots=(L,x)=>(x.hots||[]).filter(h=>h._talU===L.v.uid||h._talU===L.v);
const mine=(L,x)=>(x.hots||[]).filter(h=>h._talU===L.v&&h._talK==='mend');
const autoHit=(L,t)=>V.hit(L.v,t,10,{kind:'magic',auto:true});
const revShare=()=>VMX("skLvNum('rewind',ULT_DEF.rewind,10)");

test('Linnet: every talent is accounted for - 9 plain stats, 112 with rows, none waiting',()=>{
  accounting(H,[121,9,112,0,0]);
  for(const id of ['ml_3_4','ml_11_4','ml_6_1','gl_2_4','gl_3_4','gl_1_4','sh_3_2','sh_11_1','sh_12_4']) assert.ok(FXN.has(H,id),id+' is a plain stat');
});

test('Linnet: her real kit, as the talents read it - Mending Stitch, Reinforced Seam, Rewrite the Pattern, Golden Thread',()=>{
  const L=ll(null), {v,A}=L, sm=SM(), hp=v.healPowMul||1;
  low(L,A[1],0.3); const g=burst(L,A[1]); near(g,1e5*0.5*sm*hp,'the burst: half its max HP x the skill multiplier, healing power on top');
  const h=(A[1].hots||[]).slice(-1)[0]; near(h.hps,1e5*0.065*sm,'its mending: 6.5% of its max HP a second'); assert.equal(h.remaining,6,'six ticks');
  low(L,A[0],1); v.hp=v.maxHp*0.2; const gv=burst(L,v); assert.ok(gv>0,'she heals herself when she is the most wounded');
  v.hp=v.maxHp; low(L,A[2],0.4); blue(L); near(A[2].shield,(v.apow||0)*1.8*sm,'the Seam: 1.8 x her ability power'); near(A[2]._wardT,5,'and the hold 5 s'); near(A[2].shieldT,5);
  low(L,A[0],0.5); A[0]._hpHist=[9e4]; A[1].hp=0; A[1].alive=false; A[1]._hpHist=[8e4]; A[2]._hpHist=[1e5];
  ult(L); near(A[0].hp,Math.min(1e5,5e4+4e4*hp),'raised to the health it had (her heal: healing power on top)'); assert.ok(A[1].alive,'the fallen returns'); near(A[1].hp,8e4*revShare(),'at the share of the health it had');
  for(const a of L.A){ a.hp=a.maxHp; a.alive=true; } low(L,A[0],0.5); V.step(1); assert.equal(v._gtTo,A[0],'the thread runs to the most wounded ally');
  v.hp=v.maxHp*0.5; const gt=gain(A[0],()=>V.heal(v,1000)); near(gt,1000*0.4*v.passMul,'Golden Thread: 40% x its level of what she received');
  v.hp=v.maxHp; assert.equal(gain(A[0],()=>V.heal(v,1000)),0,'at full health she receives nothing and passes nothing');
});

test('Linnet / Stitches: Running Stitch, Tight Weave, Spare Thread, Close Weave (a big hit pulls one), Pattern Book, Master Weaver, Hold the Hem',()=>{
  const L=ll(S(['ml_1_1','ml_2_1','ml_8_1','ml_12_1','ml_10_1','ml_12_3','ml_9_1'])), {v,A,F}=L, x=A[0];
  low(L,x,0.3); green(L); secs(3.05); assert.equal(ust(L,x,'lnSt'),3,'one Stitch each second of the mending'); secs(3.1); assert.equal(ust(L,x,'lnSt'),6,'six for six seconds');
  near(ustLeft(L,x,'lnSt'),12.5-0.1,'they last 8 s + 1.5 s x 3 (from the last one)',0.03);
  x.hp=x.maxHp; x.energy=0; const big=hitOn(L,x,2e4); near(big,2e4*(1-0.17),'a hit above 10% of its max HP loses 15% + 2%'); assert.equal(ust(L,x,'lnSt'),5,'and pulls a Stitch'); assert.equal(x.energy,7+3,'Pattern Book: 3 energy (and the 7 every hit gives)');
  const mw=(x.hots||[]).slice(-1)[0]; near(mw.hps,2e4*0.17*0.30/3,'Master Weaver: 30% of what it saved, over 3 s'); assert.equal(mw.remaining,3);
  near(hitOn(L,x,8e3),8e3,'a hit of 8% pulls nothing'); assert.equal(ust(L,x,'lnSt'),5);
  for(let i=0;i<5;i++){ x.hp=x.maxHp; hitOn(L,x,2e4); } x.hp=x.maxHp; assert.equal(ust(L,x,'lnSt'),0); assert.equal(ln(L).hem[x.uid],1,'Hold the Hem: its last Stitch pulled');
  near(hitOn(L,x,2e4),2e4,'no Stitch left: nothing saved');
  const hk=v.healPowMul; v.healPowMul=0.3; low(L,x,0.2); const d2=burst(L,x); assert.ok(!ln(L).hem[x.uid],'spent'); low(L,x,0.2); const d1=burst(L,x); near(d2/d1,2,'her next heal on it doubled'); v.healPowMul=hk;
  for(let i=0;i<6;i++){ x.hp=x.maxHp; hitOn(L,x,2e4); } setUst(L,x,'lnSt',1); x.hp=x.maxHp; hitOn(L,x,2e4); assert.ok(!ln(L).hem[x.uid],'once every 8 s per ally');
  const L2=ll(S(['ml_1_1','ml_8_1'])), y=L2.A[0]; setUst(L2,y,'lnSt',8,99); low(L2,y,0.3); green(L2); secs(2.05); assert.equal(ust(L2,y,'lnSt'),9,'Spare Thread: up to 9');
});

test('Linnet / Slow Stitch (PICK ONE: 3 s longer, 30% weaker) and Long Thread (Stitches 0.25 s faster a rank); Quick Stitch (PICK ONE: 40% stronger, 2 s shorter)',()=>{
  let pB=0,pH=0; { const P0=ll(null); P0.v.healPowMul=0.5; low(P0,P0.A[0],0.3); pB=burst(P0,P0.A[0]); pH=P0.A[0].hots.slice(-1)[0].hps; }
  const L=ll(S(['ml_5_3','ml_6_3','ml_1_1'])), x=L.A[0]; L.v.healPowMul=0.5; low(L,x,0.3); near(burst(L,x)/pB,0.70,'Slow Stitch: its first heal 30% weaker'); const h=mine(L,x)[0]; assert.equal(h.remaining,9,'its mending 9 s');
  near(h.hps,pH,'the mending itself unchanged'); secs(1.05); assert.equal(ust(L,x,'lnSt'),4,'Long Thread 3/3: a Stitch every 0.25 s (4 a second)');
  const Q=ll(S(['ml_5_2'])), y=Q.A[0]; Q.v.healPowMul=0.5; low(Q,y,0.3); near(burst(Q,y)/pB,1.40,'Quick Stitch: 40% stronger'); assert.equal(mine(Q,y)[0].remaining,4,'its mending 4 s');
});

test('Linnet / Backstitch (6 Stitches: 15% less for 3 s), Linen Cloak (3 Stitches: basic attacks 5% less), Double Knot, and her allies\' ONE capped group (at most 25%)',()=>{
  const L=ll(S(['ml_1_1','ml_2_1','ml_3_1','ml_3_3','ml_4_4','ml_5_4','ml_12_4'])), {A}=L, x=A[0];
  setUst(L,x,'lnSt',6); low(L,x,0.3); green(L); x.hp=x.maxHp; near(hitOn(L,x,5e3),5e3*0.85,'Backstitch: 15% less for 3 s (a skill hit: no Linen Cloak)');
  near(hitOn(L,x,5e3,{auto:true}),5e3*0.85*0.95,'a basic attack: Linen Cloak 5% too');
  secs(3.1); setUst(L,x,'lnSt',2); near(hitOn(L,x,5e3,{auto:true}),5e3,'3 s later, and under 3 Stitches: nothing');
  ln(L).kn[A[1].uid]=6; near(hitOn(L,A[1],5e3),5e3*(1-0.02*6),'Double Knot: 2% a Knot (6 Knots with Knot Lore)');
  ln(L).kn[x.uid]=6; setUst(L,x,'lnSt',6); ln(L).bs[x.uid]=V.now()+3; near(hitOn(L,x,2e4,{auto:true}),2e4*0.75,'every source at once (Stitch pull, Backstitch, Linen Cloak, 6 Knots): held at 25%');
});

test('Linnet / Loose: Newest Rows (15% of it), Wider Window (4.5 s), Thin Wool (RISK: 12% of it, 6% more damage on her), Snap Mend, Fresh Seam and Seam Sense',()=>{
  let pB=0; { const P0=ll(null); P0.A[0].hp=1e4; pB=burst(P0,P0.A[0]); }
  const L=ll(S(['ml_2_2','ml_4_2','ml_6_4'])), {v,A}=L, x=A[0];
  low(L,x,1); hitOn(L,x,9e4); const g1=burst(L,x); near(g1,pB+0.27*9e4,'the burst restores 15% + 12% of the Loose damage more');
  x.hp=1e4; near(burst(L,x),pB+0.27*Math.max(0,9e4-g1),'what a heal of hers restored is mended: the next finds only the rest',1e-6);
  ln(L).lg={}; x.hots=[]; low(L,x,1); hitOn(L,x,9e4); secs(4.35); x.hp=1e4; near(burst(L,x),pB+0.27*9e4,'4.35 s later still Loose',1e-3);
  ln(L).lg={}; x.hots=[]; low(L,x,1); hitOn(L,x,9e4); secs(4.6); x.hp=1e4; near(burst(L,x),pB,'4.5 s later it is no longer Loose',1e-3);
  const h=v.hp; v.hp=v.maxHp=1e5; near(hitOn(L,v,1000),1000*1.06,'Thin Wool: she takes 6% more'); v.hp=h;
  const Q=ll(S(['ml_2_2','ml_5_2','ml_6_2'])), y=Q.A[0]; low(Q,y,1); hitOn(Q,y,2e4); y.hp=1e4; const g=burst(Q,y);
  ln(Q).lg={}; low(Q,y,1); y.hp=1e4; const g0=burst(Q,y); near(g-g0,(0.15+0.15)*2e4,'Snap Mend (with Quick Stitch): the first heal 15% more of it',1e-3);
  const Fz=ll(S(['ml_7_2','ml_9_2'])), z=Fz.A[0]; low(Fz,z,0.5); hitOn(Fz,z,2e4); z.hp=z.maxHp*0.29; const zh=z.hp;   // Loose 2e4, missing 7.1e4
  blue(Fz); near(z.hp-zh,2e4*1.10,'Fresh Seam: all its Loose at once, Seam Sense 10% more');
  blue(Fz); near(z.hp-zh,2e4*1.10,'and it is mended: a second Seam finds none');
});

test('Linnet / Mending Stitch: Fine Needle, Steady Stitch, Patient Weaver (below 40%), Gentle Pull (per Stitch), Double Thread (a part tick); its cooldown (Close Work, Weaver\'s Wit, Blade Sense)',()=>{
  let pB=0,pB2=0,pH=0; { const P0=ll(null); P0.v.healPowMul=0.5; low(P0,P0.A[0],0.5); pB=burst(P0,P0.A[0]); pH=P0.A[0].hots.slice(-1)[0].hps; low(P0,P0.A[0],0.3); pB2=burst(P0,P0.A[0]); }
  const L=ll(S(['ml_1_3','gl_4_1','ml_9_3','ml_7_1','ml_2_3'])), x=L.A[0]; L.v.healPowMul=0.5;
  low(L,x,0.5); near(burst(L,x)/pB,1+0.10+0.09,'Fine Needle 10% + Steady Stitch 9%');
  const h=mine(L,x)[0]; assert.equal(h.remaining,7,'Double Thread: 0.9 s longer'); near(h._talF,0.9,'a part tick at the end');
  low(L,x,0.3); near(burst(L,x)/pB2,1+0.19+0.10,'Patient Weaver: below 40% HP 10% more');
  setUst(L,x,'lnSt',6); low(L,x,0.5); near(burst(L,x)/pB,1+0.19+0.004*5*6,'Gentle Pull: 2% a Stitch');
  const M2=ll(S(['ml_1_3','gl_4_1'])), m=M2.A[0]; low(M2,m,0.5); green(M2); m.hp=1; near(gain(m,()=>secs(1.02)),pH*1.19,'its mending 19% stronger',1e-3);
  const C=ll(S(['ml_4_1','gl_10_3','sh_10_2'])); near(FX.cd(C.v,'green',7),(7-0.5-0.6)*0.95,'Close Work 0.5 s, Weaver\'s Wit 0.6 s, Blade Sense 5%'); near(FX.cd(C.v,'blue',10),9.5);
});

test('Linnet / Knots: Tie It Off (a Seam that ends ties one: 3% max HP), Knot Spell (9%), Knot Lore (6), Knotted Strength, Tight Knots; Stronger Seam, Clean Edges',()=>{
  let pS=0; { const P0=ll(null); low(P0,P0.A[0],0.4); blue(P0); pS=P0.A[0].shield; }
  const L=ll(S(['ml_4_4','ml_10_4','ml_12_4','ml_7_4','ml_8_4','ml_5_1','ml_8_3'])), {A,F}=L, x=A[0];
  low(L,x,0.4); blue(L); near(x.shield/pS,1.15,'Stronger Seam: 15% larger'); near(x._wardT,5.5,'Clean Edges: 0.5 s longer'); assert.ok(!(ln(L).kn[x.uid]>0));
  x.hp=0.4*x.maxHp; const mh=x.maxHp; secs(5.6); assert.equal(ln(L).kn[x.uid],1,'when it ends: a Knot'); near(x.maxHp,mh*1.03,'3% more max HP');
  near(x.hp,0.4*1.03*1e5+0.09*x.maxHp,'Knot Spell: 9% of its max HP',1e-6);
  for(let i=0;i<7;i++){ x.hp=0.2*x.maxHp; low(L,x,0.2); blue(L); secs(5.6); } assert.equal(ln(L).kn[x.uid],6,'Knot Lore: up to 6'); near(x.maxHp,1e5*1.18,'6 x 3%');
  const s=lost(F[0],()=>V.hit(x,F[0],1000,{kind:'true'})), p=plainHit(L,()=>lost(F[0],()=>V.hit(x,F[0],1000,{kind:'true'}))); near(s/p,1.05,'Knotted Strength: 3 Knots, 5% more damage');
  x.level=1; x.ctrlRes=0; x.stunned=0; plainHit(L,()=>V.cc(F[0],x,'stunned',2)); const ps=x.stunned; x.stunned=0; V.cc(F[0],x,'stunned',2); assert.ok(ps>0); near(x.stunned/ps,0.94,'Tight Knots: controls 6% shorter',1e-3);
});

test('Linnet / Mended Twice: healed by her twice within 4 s: 5% of max HP, once every 8 s per ally',()=>{
  const L=ll(S(['ml_10_3'])), x=L.A[0]; low(L,x,0.2); green(L); const h=x.hp; secs(1.05); const plainT=x.hots.slice(-1)[0].hps;
  near(x.hp-h,plainT+0.05*x.maxHp,'the first mending tick: a second heal of hers inside 4 s'); const h2=x.hp; secs(1.0); near(x.hp-h2,plainT,'not again within 8 s',1e-6);
});

test('Linnet / Rewrite the Pattern: Second Pattern and Gold Rewoven (multiply the share it returns), Five Seconds, Rewrite in Stitches, Quick Hands, Long Memory',()=>{
  const sh=revShare();
  const L=ll(S(['ml_11_2','ml_12_2','gl_11_3','gl_12_3','sh_9_2','ml_1_1'])), {A}=L;
  A[0].hp=5e4; A[0]._hpHist=[9e4]; A[1].alive=false; A[1].hp=0; A[1]._hpHist=[8e4]; A[2]._hpHist=[1e5]; ln(L).lsD={[A[1].uid]:1e4};
  const hpm=L.v.healPowMul||1; ult(L); near(A[1].hp,8e4*sh*1.20+1e4,'returned at 20% more of the share (10% + 10%), and its Loose mended (Rewrite in Stitches)',1e-6);
  near(A[0].hp,Math.min(1e5,5e4+4e4*1.10*hpm),'Five Seconds: its heal 10% more');
  for(const a of A) assert.equal(ust(L,a,'lnSt'),6,'every ally it touched: 6 Stitches');
  const Q=ll(S(['sh_5_3','sh_6_3'])), q=Q.A[1]; q.alive=false; q.hp=0; q._hpHist=[8e4]; q.energy=0; ult(Q); assert.ok(q.alive); assert.equal(q.energy,30,'Quick Hands: 30 energy');
  const M=ll(S(['sh_5_2','sh_6_2']),{pre:L=>{}}), m=M.A[0]; m.hp=5e4; secs(7.6); ln(M).h7[m.uid]=[9e4]; m._hpHist=[6e4]; ult(M); near(m.hp,Math.min(1e5,5e4+4e4*(M.v.healPowMul||1)),'Cut Long: 7 s back (her own record)'); assert.deepEqual(m._hpHist,[6e4],'the game\'s own history put back');
  near(hitOn(M,m,1000),1000*0.91,'Long Memory: 9% less for 4 s'); secs(4.1); near(hitOn(M,m,1000),1000);
  const C=ll(S(['sh_5_3'])), c0=C.A[0]; c0.hp=5e4; c0._hpHist=[9e4,9e4,9e4,7e4,6e4,6e4,6e4,6e4,6e4,6e4]; ult(C); near(c0.hp,5e4+2e4*(C.v.healPowMul||1),'Cut Short: 3 s back');
  near(C.T.stats.find(s=>s.stat.nrg).stat.nrg,0.25,'and 25% more energy (it comes 20% sooner)');
});

test('Linnet / Golden Pattern: every ally it touches is Gilt, the thread at least 100% for 5 s',()=>{
  const L=ll(S(['gl_11_3'])), {v,A}=L; for(const a of A) a._hpHist=[1e5]; ult(L); for(const a of A) assert.ok(ln(L).gilt[a.uid],'Gilt');
  low(L,A[0],0.5); V.step(1); v.hp=v.maxHp*0.5; near(gain(A[0],()=>V.heal(v,1000)),1000,'the thread passes 100% of what she received'); secs(5.1);
  v.hp=v.maxHp*0.5; near(gain(A[0],()=>V.heal(v,1000)),1000*0.4*v.passMul,'5 s later its own share');
});

test('Linnet / The Last Rows (20% of what each enemy dealt her side in the look-back) and Every Row Counted (2 points a rank); Cut the Pattern (SIGNATURE)',()=>{
  const L=ll(S(['sh_11_3','sh_12_3','sh_13_3'])), {v,A,F}=L; for(const a of A) a._hpHist=[1e5];
  V.hit(F[0],A[0],1e4,{kind:'true'}); V.hit(F[0],A[1],5e3,{kind:'true'}); secs(0.5); F[0]._hpHist=[1e9]; F[1]._hpHist=[1e9]; F[2]._hpHist=[1e9];
  const dm=VMX('defMul')(v,F[0],'magic'), f1=F[1].hp; const l0=lost(F[0],()=>ult(L)); near(l0,0.30*1.5e4*dm,'30% of the 15000 it dealt, magic'); near(F[1].hp,f1,'an enemy that dealt nothing takes nothing');
  const C=ll(S(['sh_13_3'])), f=C.F[0], b=C.F[1]; f.hp=8e8; f._hpHist=[5e8]; f.shield=500; b.hp=9e8; b._hpHist=[1e8]; b.t=Object.assign({},b.t,{isboss:true});
  for(const a of C.A) a._hpHist=[1e5]; ult(C); near(f.hp,5e8,'back to the health it had, lower'); assert.equal(f.shield,0,'every shield gone'); assert.equal(ust(C,f,'lnFr'),5,'Frayed to 5');
  near(ustLeft(C,f,'lnFr'),6,'for 6 s',0.02); near(b.hp,9e8-0.10*1e9,'a boss: at most 10% of its max HP');
  const h=C.F[2]; h.hp=5e8; h._hpHist=[9e8]; ult(C); near(h.hp,5e8,'higher then: unchanged');
});

test('Linnet / Not One Thread Loose (SIGNATURE): 6 s after the rewrite every heal restores all Loose, 1 Stitch a second, a free Seam once per ally a fight',()=>{
  const L=ll(S(['ml_13_2']),{big:true}), {v,A,F}=L, x=A[0]; for(const a of A) a._hpHist=[1e5]; ult(L); assert.ok(ln(L).notlT>5.9);
  secs(2.05); assert.equal(ust(L,x,'lnSt'),2,'1 Stitch a second'); low(L,x,1); hitOn(L,x,6e4); x.hp=1e4; const g=burst(L,x); near(g,Math.min(9e4,0.5*SM()*1e5*(v.healPowMul||1)+6e4),'a heal restores all its Loose',1e-3);
  x.hp=100; x.shield=0; x._wardT=0; hitOn(L,x,5e3); assert.ok(x.alive,'held at 1 HP'); assert.ok(x._wardT>4.9,'by a free Seam'); assert.ok(x.shield>0);
  x._wardT=0; x.shield=0; x.hp=100; hitOn(L,x,5e3); assert.ok(!x.alive,'once per ally a fight');
  secs(4.5); const y=A[1]; y.hp=100; y._wardT=0; hitOn(L,y,5e3); assert.ok(!y.alive,'after its 6 s: nothing');
});

test('Linnet / the thread\'s share: Tautline (Draw the Line, Breaking Strain to 59%, Taut Gold), One Strong Thread, Nothing for Herself (RISK), Woven Strength',()=>{
  const L=ll(S(['gl_2_3','gl_4_3','gl_12_2','gl_5_3','gl_6_4','gl_3_1'])), {v,A}=L, pm=v.passMul, base=1000*0.4*pm;
  low(L,A[0],0.55); V.step(1); v.hp=v.maxHp*0.5; const g=gain(A[0],()=>V.heal(v,1000/0.9)); near(g,base*1.125*1.15*(1.12/0.9),'below 59%: Tautline 12.5%, One Strong Thread 15%, Nothing for Herself',1e-6);
  v.hp=v.maxHp*0.5; near(gain(v,()=>V.heal(v,1000)),0.9*1000,'she keeps 10% less',1e-6);
  low(L,A[0],0.62); V.step(1); v.hp=v.maxHp*0.5; near(gain(A[0],()=>V.heal(v,1000/0.9)),base*1.15*(1.12/0.9),'above 59%: no Tautline',1e-6);
  v.hp=v.maxHp-500; near(gain(A[0],()=>V.heal(v,5000)),500*0.4*pm*1.15*(1.12/0.9)*1.10,'Woven Strength: she is at full health after it',1e-6);
});

test('Linnet / Two Threads (PICK ONE): the two allies nearest death, 60% each; Shared Weight; Heavy Gold with One Strong Thread',()=>{
  const L=ll(S(['gl_5_1','gl_6_1'])), {v,A}=L; low(L,A[0],0.3); A[1].hp=0.5*A[1].maxHp; V.step(1); v.hp=v.maxHp*0.5;
  const a=A[0].hp, b=A[1].hp; V.heal(v,1000); near(A[0].hp-a,1000*0.4*v.passMul*0.6,'the nearest death: 60%'); near(A[1].hp-b,1000*0.4*v.passMul*0.6,'the next: 60%');
  near(hitOn(L,A[1],1000),1000*0.94,'Shared Weight: both 6% less'); near(hitOn(L,A[2],1000),1000);
  const G=ll(S(['gl_5_3','gl_6_3'])); low(G,G.A[0],0.3); V.step(1); near(hitOn(G,G.A[0],1000),1000*0.91,'Heavy Gold: the threaded ally 9% less'); near(hitOn(G,G.A[1],1000),1000);
});

test('Linnet / Seam on the Line: Reinforced Seam always on the threaded ally, the thread at least 100% while it holds; Seam Gold',()=>{
  let pS=0; { const P0=ll(null); low(P0,P0.A[0],0.4); blue(P0); pS=P0.A[0].shield; }
  const L=ll(S(['gl_7_3','gl_9_3'])), {v,A}=L; low(L,A[0],0.6); V.step(1); v.hp=v.maxHp*0.3; blue(L); assert.ok(A[0]._wardT>4.9,'it lands on the threaded ally (she was lower)'); assert.ok(!(v._wardT>0));
  near(A[0].shield/pS,1.15,'Seam Gold: 15% larger'); v.hp=v.maxHp*0.5; near(gain(A[0],()=>V.heal(v,1000)),1000,'while it holds: 100%'); secs(5.1); v.hp=v.maxHp*0.5; near(gain(A[0],()=>V.heal(v,1000)),1000*0.4*v.passMul);
});

test('Linnet / Spindle: Spinning Wheel, Spun Fine, Spun Gold; Golden Spin; passed on at full health; Spinner\'s Calm; Kind to Herself; under the regeneration cap together',()=>{
  const L=ll(S(['gl_1_2','gl_8_2','gl_12_4','gl_3_2','gl_9_4','gl_6_2'])), {v,A,F}=L, pm=v.passMul; low(L,A[0],0.5); V.step(1);
  v.hp=v.maxHp*0.5; const x=v.maxHp*0.025*1.2*1.10; const ga=A[0].hp; near(gain(v,()=>autoHit(L,F[0])),x,'each basic attack: 2.5% of her max HP, 20% stronger, Kind to Herself 10%');
  near(A[0].hp-ga,x*0.4*pm*2,'Golden Spin: passed on doubled');
  v.hp=v.maxHp; ln(L).bud=v.maxHp; const gb=A[0].hp; autoHit(L,F[0]); near(A[0].hp-gb,x*0.4*pm*2,'at full health the thread still passes it');
  ln(L).bud=0; v.hp=v.maxHp*0.5; const h=v.hp; for(let i=0;i<20;i++){ autoHit(L,F[0]); V.step(3); } const sec=60*V.STEP;
  assert.ok(v.hp-h<=v.maxHp*0.012*sec*1.10+1e-6,'Spindle and Spinner\'s Calm together: at most 1.2% of her max HP a second ('+((v.hp-h)/v.maxHp/sec*100).toFixed(2)+'%)'); assert.ok(v.hp-h>0);
  const C=ll(S(['gl_9_4'])), w=C.v; w.hp=w.maxHp*0.8; const c0=w.hp; secs(1.02); near(w.hp-c0,w.maxHp*0.01,'Spinner\'s Calm: 1% a second above 70%',1e-3); w.hp=w.maxHp*0.6; const c1=w.hp; secs(1.05); near(w.hp-c1,0,'not at 60%');
});

test('Linnet / Gilt: Gilded, Bright Gilt (16 s after), Gold Lining, Gilt Edge, Gold Leaf, Lasting Shine, Hidden Lining (up to 3), Sure Hands',()=>{
  let hp0=0, ar0=0; { const P0=ll(null); hp0=P0.v.healPowMul; ar0=P0.v.armorRating; }
  const L=ll(S(['gl_4_4','gl_5_4','gl_7_4','gl_8_4','gl_10_2','gl_10_4','gl_11_4','gl_12_1']),{pre:L=>{ L.A[2].hp=L.A[2].maxHp*0.9; }}), {v,A,F}=L, x=A[0], y=A[1];
  V.step(1); assert.equal(v._gtTo,A[2],'the thread starts on the lowest');
  low(L,x,0.5); const sh=gain(x,()=>V.step(2)); assert.equal(v._gtTo,x); near(sh,v.maxHp*0.09,'Sure Hands: the thread comes to it: 9% of her max HP',1e-6);
  assert.ok(ln(L).gilt[x.uid],'Gilt while it is on the thread'); near(gain(x,()=>V.heal(x,1000)),1075,'Gilded: 7.5% more healing'); near(hitOn(L,x,1000),950,'Gold Lining: 5% less');
  const s=lost(F[0],()=>V.hit(x,F[0],1000,{kind:'true'})), p=plainHit(L,()=>lost(F[0],()=>V.hit(x,F[0],1000,{kind:'true'}))); near(s/p,1.04,'Gilt Edge: 4% more');
  V.step(1); near(v.healPowMul/hp0,1.05,'Gold Leaf: 2.5% healing power for each ally Gilt this wave (2)',1e-3); near(v.armorRating/ar0,1.10,'Hidden Lining: 5% armor a Gilt ally (2)',1e-3);
  low(L,y,0.4); x.hp=x.maxHp*0.9; V.step(2); assert.equal(v._gtTo,y); assert.ok(ln(L).gilt[x.uid],'it keeps Gilt after the thread moves on');
  V.step(1); near(v.armorRating/ar0,1.15,'3 Gilt allies: 15%',1e-3); x.hp=x.maxHp*0.9; secs(15.4); assert.ok(ln(L).gilt[x.uid],'16 s'); const h=x.hp; secs(0.7); assert.ok(!ln(L).gilt[x.uid],'then it fades'); near(x.hp-h,0.06*x.maxHp,'Lasting Shine: 6% of its max HP',1e-6);
  V.step(1); near(v.armorRating/ar0,1.05,'only while Gilt',1e-3); const gk=ln(L).gilt; for(const z of A.concat([F[0]])) gk[z.uid]={x:z,until:V.now()+99}; V.step(2); near(v.armorRating/ar0,1.15,'up to 3',1e-3); for(const z of A.concat([F[0]])) delete gk[z.uid];
  low(L,x,0.3); V.step(2); low(L,y,0.2); V.step(2); assert.equal(v._gtTo,y); low(L,x,0.1); near(gain(x,()=>V.step(2)),0,'Sure Hands: once every 8 s per ally',1e-9);
});

test('Linnet / Drawn Tight (at full Tautline 9%), Snap Back (8% of her max HP when the threaded ally climbs above 50%), Fast Wheel',()=>{
  let pB=0; { const P0=ll(null); low(P0,P0.A[0],0.3); pB=burst(P0,P0.A[0]); }
  const L=ll(S(['gl_2_3','gl_8_1','gl_9_1','gl_2_2','gl_1_2'])), {v,A}=L, x=A[0]; low(L,x,0.3); V.step(1); low(L,x,0.3); near(burst(L,x)/pB,1.09,'Drawn Tight: 9% stronger on the threaded ally under 50%');
  low(L,x,0.4); V.step(1); v.hp=v.maxHp*0.5; const h=v.hp; x.hp=x.maxHp*0.6; V.step(1); near(v.hp-h,v.maxHp*0.08,'Snap Back: it climbed back above 50%',1e-3);
  v.hp=v.maxHp*0.5; x.hp=x.maxHp*0.4; V.step(1); x.hp=x.maxHp*0.6; const h2=v.hp; V.step(1); near(v.hp-h2,0,'once every 5 s',1e-6);
  const F0=ll(null); const i0=F0.v.atkInterval; const W=ll(S(['gl_2_2','gl_1_2'])); low(W,W.A[0],0.6); V.step(2); near(i0/W.v.atkInterval,1.12,'Fast Wheel: 12% faster while the threaded ally is above 50%',1e-3);
  low(W,W.A[0],0.4); V.step(2); near(i0/W.v.atkInterval,1,'not below',1e-3);
});

test('Linnet / The Thread She Can See (SIGNATURE): the threaded ally under 20%: pulled to her, 25% of its max HP, 3 s of her heals on it at double strength, Gilt for the fight; once per ally',()=>{
  let pB=0; { const P0=ll(null); P0.v.healPowMul=0.4; low(P0,P0.A[0],0.1); pB=burst(P0,P0.A[0]); }
  const L=ll(S(['gl_13_3'])), {v,A}=L, x=A[0]; L.v.healPowMul=0.4; low(L,x,0.3); V.step(1); x.free=1; x.immovable=false; x.hp=x.maxHp*0.15; const h=x.hp; V.step(1);
  near(x.hp-h,0.25*x.maxHp,'mended 25%',1e-6); assert.ok(x.pullT>0&&x.pulledBy,'pulled to her side'); assert.ok(ln(L).gilt[x.uid].ever,'Gilt for the fight');
  A[1].hp=A[1].maxHp*0.05; x.hp=x.maxHp*0.1; const g=gain(x,()=>green(L)); near(g/pB,2,'her Mending Stitch goes to it (not to the lower ally), doubled',1e-3); A[1].hp=A[1].maxHp;
  secs(3.1); x.hp=x.maxHp*0.1; V.step(2); assert.equal(ln(L).tss.x,x); assert.ok(!(V.now()<ln(L).tss.until),'once per ally a fight');
});

test('Linnet / her damage reduction, ONE capped group (at most 40%): Calm Weaver, Tough Linen, Self-Mending, Stillness, Dark Water, The Bank at Carrowell, Patient Fingers',()=>{
  const L=ll(S(['gl_1_1','gl_5_2','gl_11_1','sh_1_1','sh_8_2','sh_11_4','ml_11_1','ml_1_1','ml_3_3']),{big:true}), {v,A,F}=L;
  v.hp=v.maxHp*0.9; near(hitOn(L,v,100),100*0.94*0.95,'above 70%: Calm Weaver 6%, Tough Linen 5%'); v.hp=v.maxHp*0.5; near(hitOn(L,v,100),95);
  near(hitOn(L,v,100,{auto:true}),100*0.95*0.925,'Self-Mending: basic attacks 7.5%'); near(hitOn(L,v,100,{kind:'magic'}),100*0.95*0.95*VMX('defMul')(F[0],v,'magic'),'Dark Water: magic 5%',1e-6);
  setUst(L,F[0],'lnFr',1); near(hitOn(L,v,100),100*0.95*0.94,'Stillness: from a Frayed enemy 6%'); setUst(L,F[0],'lnFr',0);
  A[2].hp=A[2].maxHp*0.2; near(hitOn(L,v,100),100*0.95*0.925,'The Bank at Carrowell: an ally below 30%'); A[2].hp=A[2].maxHp;
  for(const a of A) setUst(L,a,'lnSt',1); near(hitOn(L,v,100),100*0.95*0.925,'Patient Fingers: every ally carries Stitches'); setUst(L,A[1],'lnSt',0); near(hitOn(L,v,100),95,'not while one has none'); setUst(L,A[1],'lnSt',1);
  v.hp=v.maxHp*0.9; setUst(L,F[0],'lnFr',3); setUst(L,v,'lnSt',3); A[2].hp=A[2].maxHp*0.2; near(hitOn(L,v,100,{auto:true,kind:'magic'}),100*0.60*VMX('defMul')(F[0],v,'magic'),'everything at once: held at 40%',1e-6);
});

test('Linnet / Frayed: Sharp Edge (her basic attacks, up to 5, healing and shields 5% less a stack), Pulled Threads, Fraying Pattern, Catch, Quick Shears, Cut Free, Snagged Thread\'s link',()=>{
  const L=ll(S(['sh_1_4','sh_2_4','sh_8_4','sh_6_4','sh_3_1','sh_9_4'])), {v,F}=L, f=F[0];
  autoHit(L,f); assert.equal(ust(L,f,'lnFr'),1); near(ustLeft(L,f,'lnFr'),8,'5 s + 3 s',0.01); autoHit(L,f); assert.equal(ust(L,f,'lnFr'),2); autoHit(L,f); assert.equal(ust(L,f,'lnFr'),5,'the 3rd hit: 1 + 3 (Fraying Pattern), up to 5');
  const fh=f.hp; f.hp=f.maxHp*0.5; near(gain(f,()=>V.heal(f,1000)),1000*(1-0.25),'5 stacks: 25% less healing'); void fh;
  f.shield=777; V.step(1); assert.equal(f.shield,0,'Cut Free: reaching 5 broke its shields, none for 2 s'); f.shield=500; V.step(1); assert.equal(f.shield,0); secs(2.1); const s0=f.shield||0; f.shield=s0+1000; V.step(1); near(f.shield,s0+1000*0.75,'then a new shield 25% smaller');
  const P0=f.atkInterval; setUst(L,f,'lnFr',0); V.step(2); near(P0/f.atkInterval,1/(1-0.02*5),'Catch: 2% slower a stack',1e-3);
  setUst(L,f,'lnFr',3); v.target=f; const iv=v.atkInterval; V.step(2); near(iv/v.atkInterval,1.15,'Quick Shears: 15% faster on her target at 3 Frayed',1e-3);
  const N=ll(S(['ml_1_1','ml_n1','sh_1_4'])), x=N.A[0]; setUst(N,x,'lnSt',2); hitOn(N,x,2e4); assert.ok(mk(N,N.F[0],'lnSn'),'Snagged Thread: the puller marked'); assert.equal(ust(N,N.F[0],'lnFr'),1,'and with Sharp Edge 1 Frayed');
  near(hitOn(N,N.A[1],1000),970,'it deals 3% less for 3 s'); hitOn(N,x,2e4); assert.equal(ust(N,N.F[0],'lnFr'),1,'at most once a second');
});

test('Linnet / Cut Back (was Unravel): Mending Stitch strikes the enemy that last hit its ally (40% of what it restored, at most 15% of that enemy\'s max HP) and frays it to 5',()=>{
  const L=ll(S(['sh_1_4','sh_2_4','sh_3_4'])), {v,A,F}=L, x=A[0]; low(L,x,1); V.hit(F[1],x,5e4,{kind:'true'}); const got=Math.min(5e4,0.5*SM()*1e5*(v.healPowMul||1));
  F[1].maxHp=1e9; const l=lost(F[1],()=>green(L)); near(l,0.40*got*VMX('defMul')(v,F[1],'magic'),'40% of what it restored, magic'); assert.equal(ust(L,F[1],'lnFr'),5);
  x.hp=1e4; F[1].maxHp=1e5; F[1].hp=1e5; x._talBy=F[1]; const l2=lost(F[1],()=>green(L)); near(l2,0.15*1e5*VMX('defMul')(v,F[1],'magic'),'at most 15% of its max HP',1e-6);
});

test('Linnet / Unpicked: Pick It Out (the biggest hit each 6 s, 20% back 2 s later), Deeper Unpick, Hard Pattern, Unpicked Seam (every hit under the Seam) and Seam Unpicked',()=>{
  let pB=0; { const P0=ll(null); low(P0,P0.A[0],0.3); pB=burst(P0,P0.A[0]); }
  const L=ll(S(['sh_2_3','sh_4_3','sh_5_4'])), {A}=L, x=A[0]; x.hp=x.maxHp; hitOn(L,x,1e4); secs(0.3); hitOn(L,x,3e4); hitOn(L,x,2e4); const h=x.hp; secs(0.75); near(x.hp-h,0,'not yet');
  secs(0.2); near(x.hp-h,0.20*3e4,'0.8 s after the biggest: 20% of it',1e-6); const h2=x.hp; hitOn(L,x,4e4); secs(1); near(x.hp-h2+4e4,0,'once each 6 s',1e-6);
  low(L,x,0.3); near(burst(L,x)/pB,1.10,'Hard Pattern: her heals 10% stronger within 4 s of it');
  const U=ll(S(['sh_2_3','sh_7_3','sh_9_3'])), y=U.A[0]; low(U,y,0.9); blue(U); y.shield=0; hitOn(U,y,1e4); hitOn(U,y,2e4); const hh=y.hp; secs(2.05); near(y.hp-hh,0.20*1.10*3e4,'under the Seam every hit, 10% more',1e-6);
});

test('Linnet / her damage: Steel Needle, Needle Point, Ripper, Gilt Shears, Loose Ends, Shearer, Shears Bite Back (RISK: heals 8% weaker)',()=>{
  let pB=0; { const P0=ll(null); low(P0,P0.A[0],0.3); pB=burst(P0,P0.A[0]); }
  const L=ll(S(['sh_1_2','gl_7_1','sh_7_4','sh_2_2','sh_4_4','sh_12_2','sh_6_1'])), {v,F}=L, f=F[0];
  const keepFr=()=>ust(L,f,'lnFr'), r=(o)=>{ const n=keepFr(); setUst(L,f,'lnFr',n); const a=lost(f,()=>V.hit(v,f,1000,o)); setUst(L,f,'lnFr',n); return a/plainHit(L,()=>lost(f,()=>V.hit(v,f,1000,o))); };
  near(r({kind:'magic'}),1+0.10+0.10,'a magic skill hit: Steel Needle 10%, Shears Bite Back 10%'); near(r({kind:'phys'}),1.10);
  near(r({kind:'magic',auto:true}),1+0.10+0.15+0.15+0.10,'a basic attack: Needle Point, Ripper'); f.shield=1e9; near(r({kind:'magic',auto:true}),1+0.10+0.15+0.15+0.10+0.15,'Gilt Shears on a shielded enemy'); f.shield=0;
  setUst(L,f,'lnFr',1); near(r({kind:'magic',auto:true}),1+0.10+0.15+0.15+0.10+0.05+0.09,'Frayed: Loose Ends, Shearer'); near(r({kind:'magic'}),1+0.10+0.10+0.05,'a skill hit: Loose Ends only'); setUst(L,f,'lnFr',0);
  ln(L).hl[f.uid]=V.now(); near(r({kind:'magic',auto:true}),1+0.10+0.15+0.15+0.10+0.15,'Gilt Shears: healed in the last 2 s');
  const x=L.A[0]; low(L,x,0.3); near(burst(L,x)/pB,0.92,'Shears Bite Back: her heals 8% weaker');
});

test('Linnet / the Bobbin: Winding (an ally\'s death winds it), Spare Bobbin, Wound Tight, Full Bobbin, Thread Count, Bobbin Burst',()=>{
  let pB=0, pHP=1, pB3=0; { const P0=ll(null); pHP=P0.v.healPowMul||1; P0.v.healPowMul=0.3; low(P0,P0.A[0],0.3); pB3=burst(P0,P0.A[0]); pB=pB3; }
  const L=ll(S(['sh_4_1','sh_8_1','sh_5_1','sh_7_1','sh_10_1','sh_12_1'])), {v,A}=L; assert.equal(ln(L).bob,2,'Wound Tight: 2 at the start');
  near(A[0].maxHp,1e5*1.05,'Thread Count: 2.5% max HP a wind',1e-6); const hp0=v.healPowMul; V.step(1);
  A[2].hp=1; hitOn(L,A[2],100); assert.equal(ln(L).bob,3); for(let i=0;i<6;i++){ A[2].alive=true; A[2].hp=1; hitOn(L,A[2],100); } assert.equal(ln(L).bob,7,'Spare Bobbin: up to 7');
  V.step(1); near(v.healPowMul/pHP,1+0.05*7,'Full Bobbin: 5% healing power a wind',1e-3); void hp0;
  const keepH=v.healPowMul; v.healPowMul=0.3; low(L,A[0],0.3); const bb=burst(L,A[0]); v.healPowMul=keepH; near((bb/A[0].maxHp)/(pB3/1e5),1.30,'Bobbin Burst: full, Mending Stitch 30% more',1e-3);
  const W=ll(S(['sh_4_1'])), sh=revShare(); W.A[2].hp=1; hitOn(W,W.A[2],100); W.A[1].hp=1; hitOn(W,W.A[1],100); for(const a of W.A) a._hpHist=[1e5]; ult(W); near(W.A[1].hp,1e5*sh*(1+0.09*2),'Winding: 9% more of the share a wind');
});

test('Linnet / controls on her: Steady Hands (15%) and Tight Knots (6%) together at most 20% shorter',()=>{
  const L=ll(S(['ml_1_4','ml_8_4']),{big:true}), {v,F}=L; v.level=1; v.ctrlRes=0; v.stunned=0; plainHit(L,()=>V.cc(F[0],v,'stunned',2)); const ps=v.stunned; assert.ok(ps>0);
  v.stunned=0; V.cc(F[0],v,'stunned',2); near(v.stunned/ps,0.85,'15%',1e-3);
  ln(L).kn[v.uid]=3; v.stunned=0; V.cc(F[0],v,'stunned',2); near(v.stunned/ps,Math.max(0.80,0.85*0.94),'with 3 Knots: at most 20%',1e-3);
});

test('Linnet: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=everything(H), TEAM=['vael','sylthaine','vireo','vex','linnet'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  let st=0,fr=0,gilt=0,kn=0;
  for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ V.step(1); const o=s._tal.s.ln||{}; for(const u of VMX('units')){ const m=u._talM&&u._talM[s.uid]; if(!m) continue; if(m['#lnSt']&&m['#lnSt'].v>0) st++; if(m['#lnFr']&&m['#lnFr'].v>0) fr++; }
    if(o.gilt&&Object.keys(o.gilt).length) gilt++; if(o.kn&&Object.keys(o.kn).length) kn=1; }
  console.log('  live fight: ticks with Stitches '+st+', with Frayed '+fr+', with Gilt '+gilt+', Knots '+kn);
  assert.ok(st>0,'real Stitches'); assert.ok(fr>0,'real Frayed'); assert.ok(gilt>0,'real Gilt');
  determinism(H,TEAM);
});

/* The page sites her talents added (Mending Stitch's ally, Reinforced Seam's ally, Golden Thread's share): with nothing learned, whole seeded fights with
   Linnet in the line-up are identical to the pre-talent page (ee8edab8), seed by seed. The counters show every site was reached. */
const BASE_SHA=process.env.TALENT_BASE||'ee8edab85c45b52cf17c71c5e4890e03deb753bc';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-')); TMP.push(dir);
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); return SH.load(path.join(dir,'emberweave-heroes.html')); }
let BASE=null; try{ BASE=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+') - the identity check against it is skipped'); }
test('Linnet: no talents - whole fights with her in the line-up are identical to the pre-talent page, and they reach every site her talents added',{skip:!BASE},()=>{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['linnet','vael','vireo','sylthaine','gruel'], foeTeam=['ambrel','dandra','konwu','ceraline','joss'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>Object.assign(spec(k,70),{skillLv:[60,60,60,60]}))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __lnN={ms:0,seam:0,gt:0,rw:0}; var __lnD=_doEffectCore, __lnH=healUnit;'+
    '_doEffectCore=function(u,type,o){ if(u&&(u.key==="linnet"||u.key==="dandra"||u.key==="joss")){ if(type==="mendburst") __lnN.ms++; if(type==="lastbreath") __lnN.seam++; if(type==="rewind") __lnN.rw++; } return __lnD.apply(this,arguments); };'+
    'healUnit=function(u,a){ if(u&&u.pass&&u.pass.goldthread&&u._gtTo&&u._gtTo.alive&&u._gtTo!==u&&!u._healing&&Math.min(a,worldHealCap(u)-u.hp)>0) __lnN.gt++; return __lnH.apply(this,arguments); };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>Object.assign(spec(k,68),{skillLv:[60,60,60,60]})))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'her on the other side, seed '+seed); n+=2; }
    const c=VMX('__lnN'); console.log('  identity / sites reached: '+JSON.stringify(c));
    assert.ok(c.ms>0&&c.seam>0&&c.gt>0&&c.rw>0,'Mending Stitch (and Seedlight), Reinforced Seam (and Sanctuary Guard), Golden Thread\'s share and Rewrite all ran'); }
  finally{ VMX('_doEffectCore=__lnD; healUnit=__lnH;'); }
  assert.ok(n>=18);
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and a build that sits at that ceiling for more than half a battle is too strong. Her damage-reduction
   talents (and armor / max HP), each candidate build at 91 points legal; the most defensive is the one whose worst hit is reduced most. */
const DEF={ ml:['ml_11_1','ml_1_1','ml_12_1','ml_3_1','ml_3_3','ml_5_4','ml_11_4','ml_12_4'],
            gl:['gl_1_1','gl_5_2','gl_11_1','gl_3_4','gl_2_4'],
            sh:['sh_1_1','sh_8_2','sh_11_4','sh_11_1','sh_3_2','sh_6_2'] };
function defensive(order,caps){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={ml:0,gl:1,sh:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of DEF[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
/* the worst hit on her: every condition of her damage-reduction talents true at once (above 70% HP, an ally below 30%, every ally Stitched, she carries 6 Stitches,
   is under Backstitch and Long Memory, holds 6 Knots, the attacker Frayed and Snagged, a basic attack, a big hit that pulls a Stitch); sustained: a usual state
   (half HP, no ally low, no Stitches, the attacker not Frayed, a basic attack of 5% of her max HP). Measured through the engine (HP and shield it takes) */
function worstHit(list,kind,crit,sustained){ const L=ll(list,{big:true}), {v,A,F}=L, f=F[0];
  v.hp=sustained?5e4:9e4;
  if(L.T&&!sustained){ const o=ln(L); for(const a of A) setUst(L,a,'lnSt',1); setUst(L,v,'lnSt',6); A[2].hp=A[2].maxHp*0.2; setUst(L,f,'lnFr',5); o.kn=o.kn||{}; o.kn[v.uid]=6; (o.bs||(o.bs={}))[v.uid]=V.now()+9; (o.lm||(o.lm={}))[v.uid]=V.now()+9;
    const M=f._talM||(f._talM={}), oo=M[v.uid]||(M[v.uid]={}); oo.lnSn={t0:V.now(),until:V.now()+9,v:0}; }
  v.shield=0;
  const raw=sustained?5e3:2e4, x=lost(v,()=>V.hit(f,v,raw,{kind,crit,auto:true})), cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1;
  return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Linnet: her most defensive legal 91-point build never takes more than 95% off a hit, and never sits near that ceiling in a seeded fight; her allies\' group holds at 25%',()=>{
  const cands=[[['ml','gl'],[61,30]],[['ml'],[91]],[['gl','sh'],[61,30]],[['sh','ml'],[61,30]],[['ml','sh'],[61,30]],[['gl','ml'],[61,30]],[['ml','gl','sh'],null]].map(([o,c])=>{ const b=defensive(o,c); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; for(const kind of ['magic','phys']) for(const crit of [false,true]) c.worst=Math.max(c.worst,worstHit(c.list,kind,crit,false)); c.sus=Math.max(worstHit(c.list,'phys',false,true),worstHit(c.list,'magic',false,true)); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false))), noneS=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,true)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' worst '+(c.worst*100).toFixed(1)+'% sustained '+(c.sus*100).toFixed(1)+'%').join(' | '));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.90,'the worst possible hit on her most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 90%');
  VMX('var __dr={max:0,n:0,at:0,hi:0,ticks:0,imm:0,tHi:0,an:0,amax:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&src&&src.team!==tgt.team&&tgt.key==="linnet", al=tgt&&src&&src.team!==tgt.team&&!me&&units.some(x=>x.key==="linnet"&&x._tal&&x.team===tgt.team); let h0=0, f0=1; if(me||al){ h0=tgt.hp+(tgt.shield||0); tgt._critHit=false; } const r=__ddc.apply(this,arguments);'+
    '  if((me||al)&&amt>0&&tgt.alive&&!tgt._critHit){ const l=h0-tgt.hp-(tgt.shield||0), raw=amt*elemMul(src,tgt); if(raw>0&&l>1e-6*raw){ const d=1-l/raw; if(me){ __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } else { __dr.an++; } } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(u&&u.key==="linnet"&&u.alive){ __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++; const T=u._tal, A=T&&T.s.ln&&T.s.ln.api; if(A){ const e=units.find(x=>x.team!==u.team&&x.alive); if(e){ const k=T.fn.drK(A,T,u,u,e,{auto:true,kind:"phys",amt:0.05*u.maxHp,probe:true},true); if(1-k*defMul(e,u,"phys")>=0.85) __dr.tHi++; } } } } return __ubc.apply(this,arguments); };');
  try{ const sn=snaps(['vael','sylthaine','vireo','vex','linnet'].map(k=>Object.assign(spec(k,100,k===H?best.list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','fritz'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const d=VMX('__dr'); console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%), sustained '+(best.sus*100).toFixed(1)+'% (no talents '+(noneS*100).toFixed(1)+'%); seeded fights: '+d.n+' hits on her, the most reduced '+(d.max*100).toFixed(1)+'%, 85% or more '+d.hi+'; at the ceiling '+d.at+'; ticks '+d.ticks+' (at 85% or more against a reference basic attack '+d.tHi+', '+(100*d.tHi/Math.max(1,d.ticks)).toFixed(1)+'%), immune '+d.imm+'; hits on her allies '+d.an);
    assert.ok(d.n>20&&d.ticks>500,'hits on her: '+d.n);
    assert.ok(d.max<0.95,'no hit on her was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0); assert.equal(d.imm,0); assert.ok(d.hi<0.5*d.n,'above 85% for less than half of the hits'); assert.ok(d.tHi<0.5*d.ticks,'above 85% for less than half of the fight'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
  /* her allies: every reduction she gives at once (a big hit that pulls a Stitch, Backstitch, Linen Cloak, 6 Knots, Gold Lining, Heavy Gold, Long Memory, a Snagged attacker): at most 25% */
  const L=ll(S(['ml_1_1','ml_12_1','ml_2_1','ml_3_1','ml_3_3','ml_4_4','ml_5_4','ml_12_4','gl_4_4','gl_7_4','gl_5_3','gl_6_3','sh_5_2','sh_6_2','ml_n1'])), {A,F}=L, x=A[0];
  low(L,x,0.5); V.step(1); const o=ln(L); setUst(L,x,'lnSt',6); o.kn[x.uid]=6; (o.bs||(o.bs={}))[x.uid]=V.now()+9; (o.lm||(o.lm={}))[x.uid]=V.now()+9; const M=F[0]._talM||(F[0]._talM={}), oo=M[L.v.uid]||(M[L.v.uid]={}); oo.lnSn={t0:V.now(),until:V.now()+9,v:0};
  near(hitOn(L,x,2e4,{auto:true}),2e4*0.75,'every reduction she gives an ally at once: held at 25%');
});
