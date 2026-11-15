'use strict';
/* Sorrel's talents as data on the mechanics layer (talents-mech/sorrel.js), group by group on the still field (tests/talents-lab.js), then whole fights, the
   no-talent identity of the page sites his talents added (Loaded Hand's swing, his cards' landing pair), and Phil's 95% ceiling.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with his talents switched off
   for one hit (plainHit) or in a plain lab built BEFORE the talented one (lab() replaces the whole field).
   sl(): the lab with Sorrel, two allies and three foes, everyone held, every Energy at 0. swing(): one swing of his as Loaded Hand counts it (the page's num
   hook 'lhSwing', which is what the page calls at each wind-up); draw(): the next swing draws. seq([...]): the seeded stream answers these numbers in order
   (then 0.999: no Wild Card, no Double or Nothing, no talent crit, the heal suit). Suits: 0 heavy hit, 1 stun, 2 armour break, 3 heal.
   Places (metres from Sorrel, centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0); A0 (0,-5.5) A1 (0,-11). Marked Deal and Grand Reveal reach the nearest enemies.
   Run: node --test tests/talents-mech-sorrel.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,J,lab,lost,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='sorrel', S=ids=>full(H,ids);
const TMP=[]; test.after(()=>{ for(const d of TMP) try{ fs.rmSync(d,{recursive:true,force:true}); }catch(e){} });
const VMX=s=>vm.runInContext(s,NOW.ctx);
test.afterEach(()=>{ FX.define(H,null); brndBack(); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const seq=a=>VMX('var __sbr=(typeof __sbr!=="undefined"&&__sbr)?__sbr:brnd; var __sq='+JSON.stringify(a)+'; brnd=function(){ return __sq.length?__sq.shift():0.999; };');
const brndBack=()=>VMX('if(typeof __sbr!=="undefined"&&__sbr){ brnd=__sbr; __sbr=null; }');
const left=()=>VMX('__sq.length');
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{},{n,t:99,idle:0}); };
const stk=(L,name)=>{ const k=L.T.s.k[name]; return k?k.n:0; };
const win=(L,name)=>{ const w=L.T.s.w[name]; return !!w&&w.t>0; };
const setWin=(L,name,t)=>{ L.T.s.w[name]={t:t==null?99:t,n:1,cdT:0,at:-1,wave:false}; };
const so=L=>L.T.s.so||(L.T.s.so={});
const tru=o=>Object.assign({kind:'true'},o||{});
const hitOn=(L,src,t,amt,o)=>lost(t,()=>V.hit(src,t,amt||1000,tru(o)));
const ratio=(L,src,t,o)=>{ const h=t.hp, a=hitOn(L,src,t,1000,o); t.hp=h; const b=plainHit(L,()=>hitOn(L,src,t,1000,o)); t.hp=h; return a/b; };
const low=(x,f)=>{ x.hp=x.maxHp*f; };
const free=x=>{ x.stunned=0; x.speed=0; x.atkCd=1e9; x.greenCd=99; x.blueCd=99; x.energy=0; x.ctrlRes=0; };   // a unit that thinks but does nothing (a talent stun can land on it)
const swing=(L,t)=>VMX('TalentFx').num(L.v,'lhSwing',0,t||L.F[0]);
const draw=(L,t)=>{ so(L).n=Math.max(so(L).n||0,3); so(L).b2bNext=false; return swing(L,t); };
const SUIT={'fx-heart':0,'fx-spade':1,'fx-diamond':2,'fx-club':3};
const played=fn=>{ VMX('floatTexts.length=0'); fn(); return Array.from(VMX('floatTexts')).map(f=>f.img).filter(x=>x&&SUIT[x]!=null).map(x=>SUIT[x]); };
const PM=L=>L.v.passMul||1, SH=(L,k)=>0.25*PM(L)*k;
const shredOf=(L,t,fn)=>{ t._shredPct=0; t._shredT=0; fn(); return t._shredPct; };
const NERF=V.ccNerf;
const green=(L,t)=>{ V.cast(L.v,'green',t||L.F[0]); }, ult=L=>V.cast(L.v,'ult'), blue=L=>V.cast(L.v,'blue');
const budget=L=>{ const o=so(L); o.rgAt=V.now(); o.rgV=1e9; };
const FPOS=[[4.5,0],[10,0],[15.5,0]], APOS=[[0,-5.5],[0,-11]];
/* the game's wave change (resetPerWave, beginWaveEnter: the clock back to 0), then the still field put back as lab() set it */
function waveNext(L){ VMX('resetPerWave(); beginWaveEnter(); waveXfer=null;'); const {v,A:Al,F}=L; for(const u of L.U){ u.stunned=1e6; u.fearT=0; u.target=null; }
  v.x=300; v.y=700; const put=(u,dx,dy)=>{ u.x=v.x+dx*V.METER; u.y=v.y+dy*V.METER; u._ax=u.x; u._ay=u.y; u.px=u.x; u.py=u.y; };
  put(v,0,0); F.forEach((f,i)=>put(f,FPOS[i][0],FPOS[i][1])); Al.forEach((a,i)=>put(a,APOS[i][0],APOS[i][1])); }
function sl(list,o){ o=o||{}; const L=lab(H,list,{allies:o.allies==null?2:o.allies,foes:o.foes==null?3:o.foes,big:o.big,seed:o.seed});
  for(const x of L.U){ x.energy=0; } return L; }
/* each card's hit on t during fn, in order */
function cards(L,t,fn,s){ const out=[]; let h=t.hp; fn(); for(let i=0;i<Math.round((s||1.2)/V.STEP);i++){ V.step(1); const d=h-t.hp; if(d>1e-6) out.push(d); h=t.hp; } return out; }

test('Sorrel: every talent is accounted for - 6 plain stats, 118 with rows, none waiting',()=>{
  accounting(H,[124,6,118,0,0]);
  for(const id of ['sd_4_1','sd_1_3','hc_4_1','hc_10_4','sc_2_3','sc_1_3']) assert.ok(FXN.has(H,id),id+' is a plain stat');
  for(const id of ['sd_11_3','hc_1_2','sc_11_3']) assert.ok(!FXN.has(H,id)&&FXN.mech(H).talents[id],id+': crit chance, in the capped group (not a plain stat)');
  const M=FXN.mech(H); for(const id of ['sd_13_2','hc_13_2','sc_13_2','sc_n1','sd_1_1','hc_1_1','sc_1_1']) assert.ok(M.talents[id],id);
});

test('Sorrel: his real kit, as the talents read it - Marked Deal\'s three cards and its mark, House Edge, Grand Reveal, Loaded Hand at every fourth swing',()=>{
  let L=sl(null), {v,F}=L; assert.ok(!v._tal,'no talents: no runtime'); assert.ok(v.pass&&v.pass.loadedhand,'his passive');
  const c=cards(L,F[0],()=>green(L,F[1])); assert.equal(c.length,3,'Marked Deal: three cards'); near(c[1],c[0],'',1e-9); near(c[2],c[0],'',1e-9);
  assert.equal(F[1].hp,F[1].maxHp,'they go to the nearest enemy, not to the one aimed at');
  assert.ok(F[0]._markT>4.5&&F[0]._markT<=6,'the mark: 6 s'); near(F[0]._markMul,1.22,'x1.22',1e-9);
  for(const src of [v,L.A[0]]){ const h=F[0].hp, a=hitOn(L,src,F[0],1000); F[0].hp=h; const m=F[0]._markT; F[0]._markT=0; const b=hitOn(L,src,F[0],1000); F[0].hp=h; F[0]._markT=m; near(a/b,1.22,'a marked enemy takes 22% more (from anyone)',1e-9); }
  L=sl(null); ({v,F}=L);   // the mark lands right after the third card, not before it
  let at3=-1, atM=-1, n=0, h=F[0].hp; green(L,F[0]); for(let i=0;i<40;i++){ V.step(1); if(F[0].hp<h-1e-6){ n++; h=F[0].hp; if(n===3) at3=i; } if(atM<0&&(F[0]._markT||0)>0) atM=i; }
  assert.ok(at3>=0&&atM>=at3&&atM<=at3+2,'the third card first, the mark at most 2 ticks later ('+at3+', '+atM+')');
  const hm=VMX('skLvNum')('haste',v.blueAb,10); blue(L); near(v.hasteMul,hm,'House Edge: attack speed x(1.32 + 0.002 a level)',1e-9); near(v.hasteT,6,'for 6 s',1e-9);
  L=sl(null); ({v,F}=L); for(const f of F) assert.ok(!(f._markT>0)); blue(L); near(v.hasteMul,hm,'whether a marked enemy stands or not (the card says "while marked enemies are present")',1e-9);
  const h0=F.map(f=>f.hp); ult(L); secs(0.5); for(let i=0;i<3;i++) assert.ok(F[i].hp<h0[i],'Grand Reveal: a card into each of the nearest enemies');
  L=sl(null); ({v,F}=L); free(F[0]); v.stunned=0; v.target=F[0]; v.atkCd=0; v.greenCd=1e9; v.blueCd=1e9; let c0=v.atkCd, sw=0, fx=[];
  let nS=0; for(let i=0;i<Math.round(24/V.STEP);i++){ VMX('floatTexts.length=0'); v.energy=0; V.step(1); const k=Array.from(VMX('floatTexts')).filter(f=>SUIT[f.img]!=null).length; nS+=k; if(v.atkCd>c0+0.5) sw++; c0=v.atkCd; if(k) fx.push(sw); }
  assert.ok(sw>=8,'swings: '+sw); assert.ok(fx.every(x=>x%4===0),'at the 4th, 8th... swing: '+fx.join(',')); assert.equal(nS,Math.floor(sw/4),'Loaded Hand: a suit every fourth swing (swings '+sw+', suits at swings '+fx.join(',')+')');
});

test('Sorrel: with a talent learned his rows run Loaded Hand - the same seeded draw, the same suits and the same damage as the passive',()=>{
  const run=list=>{ const L=sl(list,{seed:31}), {v,F}=L; free(F[0]); free(F[1]); v.stunned=0; v.target=F[0]; v.atkCd=0; const got=[];
    for(let i=0;i<Math.round(40/V.STEP);i++){ VMX('floatTexts.length=0'); V.step(1); for(const f of Array.from(VMX('floatTexts'))) if(SUIT[f.img]!=null) got.push(SUIT[f.img]); }
    return {got,hp:[F[0].hp,v.hp,F[0]._shredPct||0,F[0]._shredT||0,F[0].stunned||0].map(x=>+x.toFixed(6)),tal:!!v._tal}; };
  const a=run(null), b=run(S(['hc_5_1'])); assert.ok(!a.tal&&b.tal); assert.ok(a.got.length>=4,'suits drawn: '+a.got.join(','));
  assert.deepEqual(b.got,a.got,'the same suits'); assert.deepEqual(b.hp,a.hp,'the same damage, heals and armour break');
});

/* ======================= THE STACKED DECK ======================= */
test('Sorrel / Counting Cards (no suit twice until all four; each full round 1 Count, 1% x 3 damage each, up to 5), Card Sharp, Counted Out, Stacked Deck, Long Count, Full House',()=>{
  const L=sl(S(['sd_1_4','sd_3_4','sd_5_4','sd_9_4','sd_12_1','sd_7_4'])), {v,F}=L; v.greenCd=5;
  seq([0,0,0,0]); const s=[]; for(let i=0;i<4;i++) s.push(...played(()=>draw(L))); assert.deepEqual(s,[0,1,2,3],'never the same suit until all four have come up');
  assert.equal(stk(L,'soCnt'),1,'a full round: 1 Count'); near(v.greenCd,5-1.0,'Counted Out: 0.2 s x 5 off Marked Deal',1e-9);
  near(ratio(L,v,F[1]),1.03,'Counting Cards: 1% x 3 per Count',1e-9);
  near(L.T.fn.critP(so(L).api,L.T,v,{tgt:F[1]}),0.025,'Card Sharp: 0.5% x 5 per Count',1e-12);
  seq([0.9]); assert.deepEqual(played(()=>draw(L)),[0],'Stacked Deck: after a full round, the heavy hit (he is above 50%)');
  seq([0.4,0.6,0.99]); for(let i=0;i<3;i++) played(()=>draw(L)); assert.equal(stk(L,'soCnt'),2); low(v,0.4); seq([]); assert.deepEqual(played(()=>draw(L)),[3],'below 50%: the heal');
  assert.equal(left(),0,'(a forced suit draws nothing)'); setStack(L,'soCnt',4); near(shredOf(L,F[1],()=>{ L.T.fn.play(so(L).api,L.T,v,F[1],2,0,{}); }),SH(L,1),'',1e-9); setStack(L,'soCnt',5);
  near(shredOf(L,F[1],()=>{ L.T.fn.play(so(L).api,L.T,v,F[1],2,0,{}); }),SH(L,1.15),'Full House: at 5 Count the suits 5% x 3 stronger',1e-9);
  near(ratio(L,v,F[1]),1.15,'5 Count: 15% (at most 5)',1e-9); setStack(L,'soCnt',5); near(L.T.fn.critP(so(L).api,L.T,v,{tgt:F[1]}),0.05,'Card Sharp at 5 Count: 12.5% asked, the group holds 5%',1e-12);
  L.T.s.fresh=true; V.step(1); assert.equal(stk(L,'soCnt'),3,'Long Count: 1 x 3 kept into the next wave');
});

test('Sorrel / Up the Sleeve (every other suit palmed; the next Marked Deal plays it on its marking card, 4% x 5 stronger), Quick Palm, Cold Read, Sleight of Hand, Bottom Deal',()=>{
  const L=sl(S(['sd_1_1','sd_2_1','sd_6_1','sd_7_1','sd_11_1'])), {v,F}=L; V.step(1); const i0=v.atkInterval, a0=v.dmg;
  seq([0.6,0.6]); assert.deepEqual(played(()=>draw(L)),[2],'the first suit is played'); assert.deepEqual(played(()=>draw(L)),[],'the second is palmed');
  assert.deepEqual(J(so(L).palm.map(p=>p.s)),[2]); V.step(1); near(i0/v.atkInterval,1.12,'Quick Palm: 4% x 3 faster while he holds it',1e-6);
  const r0=ratio(L,v,F[1],{kind:'phys'}); assert.ok(r0>1.0001,'Cold Read: his hits ignore 2% x 3 of armour while he holds it ('+r0+')');
  seq([0.6]); assert.deepEqual(played(()=>draw(L)),[2],'(the third suit is played: he holds one)'); seq([0.6]); assert.deepEqual(played(()=>draw(L)),[2],'(the fourth too: no room)');
  F[0]._shredPct=0; F[0]._shredT=0; F[0]._markT=0; const pl=played(()=>{ green(L,F[0]); secs(0.5); }); assert.deepEqual(pl,[],'not on the first two cards'); assert.ok(!(F[0]._shredPct>0));
  assert.deepEqual(played(()=>secs(0.4)),[2],'on the marking card'); near(F[0]._shredPct,SH(L,1.20),'4% x 5 stronger',1e-9);
  assert.equal(so(L).palm.length,0,'the sleeve is empty'); V.step(2); near(v.atkInterval,i0,'Quick Palm off',1e-6); near(ratio(L,v,F[1],{kind:'phys'}),1,'Cold Read off',1e-9);
  V.step(1); near(v.dmg/a0,1.025,'Bottom Deal: a palmed suit played, 0.5% x 5 attack for the wave',1e-6);
  /* Sleight of Hand: a palmed heavy hit 4% x 5 more on top (at the same moment as a plain heavy hit) */
  F[1]._markT=0; const one=lost(F[1],()=>L.T.fn.play(so(L).api,L.T,v,F[1],0,0,{})), pal=lost(F[1],()=>L.T.fn.play(so(L).api,L.T,v,F[1],0,0,{palm:true})), pa=lost(F[1],()=>L.T.fn.play(so(L).api,L.T,v,F[1],2,0,{palm:true}));
  near(pal/one,1+0.20+0.20,'a palmed heavy hit: Up the Sleeve 20% + Sleight of Hand 20%',1e-6); assert.equal(pa,0);
  L.T.s.fresh=true; V.step(2); near(v.dmg/a0,1,'Bottom Deal: for the wave',1e-6);
});

test('Sorrel / Second Sleeve (2 palmed: one on the second card, one on the third), The Cooler (all three cards carry them), Card Up Each Cuff (a suit palmed at each wave\'s start, 5% x 3 stronger)',()=>{
  let L=sl(S(['sd_1_1','sd_3_1'])); seq([0.6,0.6,0.99,0.99]); for(let i=0;i<4;i++) played(()=>draw(L)); assert.deepEqual(J(so(L).palm.map(p=>p.s)),[2,3],'Second Sleeve: he holds 2');
  green(L,L.F[0]); assert.deepEqual(played(()=>secs(0.34)),[],'card 1: nothing'); assert.deepEqual(played(()=>secs(0.15)),[2],'card 2: the first'); assert.deepEqual(played(()=>secs(0.2)),[3],'card 3: the second');
  L=sl(S(['sd_1_1','sd_9_1'])); so(L).palm=[{s:2,k:0}]; green(L,L.F[0]); assert.deepEqual(played(()=>secs(1)),[2,2,2],'The Cooler: all three cards carry it');
  L=sl(S(['sd_1_1','sd_3_1','sd_9_1'])); so(L).palm=[{s:2,k:0},{s:3,k:0}]; green(L,L.F[0]); assert.deepEqual(played(()=>secs(1)).sort(),[2,2,2,3,3,3],'both, on every card');
  L=sl(S(['sd_8_1'])); assert.equal(so(L).palm.length,1,'(the first wave: a suit palmed)'); so(L).palm=[]; seq([0.6]); L.T.s.fresh=true; V.step(1); assert.deepEqual(J(so(L).palm.map(p=>[p.s,+p.k.toFixed(9)])),[[2,0.15]],'Card Up Each Cuff: a seeded suit, 5% x 3');
  L.F[0]._shredPct=0; green(L,L.F[0]); secs(1); near(L.F[0]._shredPct,SH(L,1.15),'played on the marking card (no Up the Sleeve: 15%)',1e-9);
  seq([0.6]); L.T.s.fresh=true; V.step(1); assert.equal(so(L).palm.length,1,'each wave');
});

test('Sorrel / Marked Cards (every third swing while his target is marked), Fast Draw (10% x 3 on the third), Back-to-Back (then the fourth too), House Always Wins (every second in House Edge)',()=>{
  let L=sl(S(['sd_5_2'])); const n=(L,k,t)=>{ let d=[]; for(let i=0;i<k;i++) d.push(played(()=>swing(L,t)).length); return d; };
  assert.deepEqual(n(L,8,L.F[0]),[0,0,0,1,0,0,0,1],'unmarked: every fourth'); L.F[0]._markT=50; assert.deepEqual(n(L,6,L.F[0]),[0,0,1,0,0,1],'marked: every third');
  L=sl(S(['hc_8_1','hc_9_1'])); seq([0.5]); assert.deepEqual(n(L,4),[0,0,0,1],'Fast Draw: 0.5 on the third swing does not');
  seq([0.29]); assert.deepEqual(n(L,4),[0,0,1,1],'0.29 (< 30%): the third draws, and Back-to-Back the fourth too'); seq([0.31]); assert.deepEqual(n(L,4),[0,0,0,1],'0.31 does not');
  L=sl(S(['hc_8_1'])); seq([0.29]); assert.deepEqual(n(L,6),[0,0,1,0,0,0],'without Back-to-Back: only the third');
  L=sl(S(['sd_11_2'])); setWin(L,'soHe'); assert.deepEqual(n(L,4),[0,1,0,1],'House Always Wins: every second swing in House Edge'); L.T.s.w.soHe.t=0; assert.deepEqual(n(L,4),[0,0,0,1],'after House Edge: every fourth again');
});

test('Sorrel / Clean Deck (stun 0.5 s longer, heal 30% more), Shaking Paw (+0.1 s x 2), Hard Cards, Green Lamp, House Rules and Broken Armour (armour break), Lowmere Luck, Last Chip, the armour-break top',()=>{
  const L=sl(S(['sd_5_3','hc_6_4','hc_3_3','hc_10_1','sd_6_3','hc_7_3','sc_8_3','hc_12_4'])), {v,F}=L, A=so(L).api; V.step(1); free(F[1]);
  L.T.fn.play(A,L.T,v,F[1],1,0,{}); near(F[1].stunned,0.5*NERF+0.5+0.2,'the stun suit: 0.35 s + 0.5 s + 0.2 s, in full',1e-9);
  F[1].stunned=0; F[1].ctrlRes=0.5; L.T.fn.play(A,L.T,v,F[1],1,0,{}); near(F[1].stunned,(0.5*NERF+0.7)*0.5,'(its control resist applies)',1e-9); F[1].ctrlRes=0;
  near(shredOf(L,F[1],()=>L.T.fn.play(A,L.T,v,F[1],2,0,{})),SH(L,1+0.15+0.20),'armour break: House Rules 5% x 3 + Broken Armour 4% x 5',1e-9);
  F[1]._markT=9; near(shredOf(L,F[1],()=>L.T.fn.play(A,L.T,v,F[1],2,0,{})),SH(L,1+0.35+0.10),'Lowmere Luck: on a marked enemy 2% x 5 more',1e-9); F[1]._markT=0;
  low(v,0.25); near(shredOf(L,F[1],()=>L.T.fn.play(A,L.T,v,F[1],2,0,{})),SH(L,1+0.35+0.18),'Last Chip: below 30% HP 6% x 3 more',1e-9); low(v,0.8);
  near(shredOf(L,F[1],()=>L.T.fn.play(A,L.T,v,F[1],2,0,{mul:9})),0.75,'an armour break never above 75%',1e-9);
  low(v,0.33); const a=VMX('rageMul')*v.dmg, h=v.hp; L.T.fn.play(A,L.T,v,F[1],3,0,{}); near(v.hp-h,a*0.5*PM(L)*(1+0.30+0.20),'the heal suit: Clean Deck 30% + Green Lamp 4% x 5',1e-6);
  const P0=sl(S(['hc_5_1'])), w=P0.v; V.step(1); const b0=lost(P0.F[1],()=>P0.T.fn.play(so(P0).api,P0.T,w,P0.F[1],0,0,{}));
  const L2=sl(S(['hc_3_3'])); V.step(1); const b1=lost(L2.F[1],()=>L2.T.fn.play(so(L2).api,L2.T,L2.v,L2.F[1],0,0,{})); near(b1/b0,1.20,'Hard Cards: the heavy hit 4% x 5 more',1e-6);
});

test('Sorrel / Marked Deal\'s cards: Edged Cards, Clean Throw, Spin the Deck (3% x 5 each), Second Card (its second card 5% x 3), Long Mark (0.4 s x 5), Quick Deal and Quick Hands',()=>{
  const P0=sl(null), p=cards(P0,P0.F[0],()=>green(P0,P0.F[0])); assert.equal(p.length,3);
  const L=sl(S(['sd_2_2','sc_3_3','hc_8_2','sd_9_2','sd_3_3','sd_8_2','sc_8_2'])), c=cards(L,L.F[0],()=>green(L,L.F[0])), k=1.15*1.15*1.15;
  near(c[0]/p[0],k,'three cards 15% x 3',1e-6); near(c[1]/p[1],k*1.15,'the second card: 15% more',1e-6); near(c[2]/p[2],k,'',1e-6);
  near(L.F[0]._markT,8,'Long Mark: 6 s + 2 s (the mark does not run down on a held lab enemy)',1e-9);
  near(VMX('TalentFx').cd(L.v,'green',6),6-0.5-0.5,'Quick Deal and Quick Hands: 0.1 s x 5 each',1e-9);
});

test('Sorrel / Grand Reveal: Fanned Deck and Giant Cards (3% x 5 each), Deeper Mark, Steady Edge, Point First, Close Game, Final Hand, Fine Gloves',()=>{
  const P0=sl(null), h0=P0.F.map(f=>f.hp); ult(P0); secs(0.5); const p=P0.F.map((f,i)=>h0[i]-f.hp);
  const L=sl(S(['sd_7_3','sc_7_3','sd_4_2','sd_10_1','sd_9_3','hc_9_3','sc_9_3'])), {v,F}=L, h1=F.map(f=>f.hp); ult(L); secs(0.5);
  for(let i=0;i<3;i++) near((h1[i]-F[i].hp)/p[i],1.15*1.15,'Grand Reveal 15% x 2',1e-6);
  near(ratio(L,v,F[1]),1,'',1e-9); F[1]._markT=9; near(ratio(L,v,F[1]),1.03,'Deeper Mark: a marked enemy 1% x 3 more',1e-9); F[1]._markT=0;
  near(ratio(L,v,F[1],{auto:true}),1.10,'Steady Edge: his basic attacks 2% x 5 more',1e-9);
  low(F[1],0.42); near(ratio(L,v,F[1]),1,'',1e-9); low(F[1],0.39); near(ratio(L,v,F[1]),1.10*1.10,'below 40%: Point First and Close Game',1e-9); low(F[1],0.32); near(ratio(L,v,F[1]),1.10*1.10,'',1e-9); low(F[1],0.29); near(ratio(L,v,F[1]),1.10*1.10*1.15,'below 30%: and Final Hand',1e-9); low(F[1],0.9);
  const G=sl(S(['sc_6_4'])); assert.ok(ratio(G,G.v,G.F[1],{kind:'phys'})>1.0001,'Fine Gloves: his physical hits ignore 3% x 2 of armour'); near(ratio(G,G.v,G.F[1]),1,'(true damage: nothing to ignore)',1e-9);
});

test('Sorrel / crit damage: Read the Table (marked, 2% x 5), Ace in the Cuff (the first hit each wave, 5% x 2), Lucky Strike (his suits, 4% x 5), Old Signatures (Signed, 3% x 3)',()=>{
  const L=sl(S(['sd_8_3','sd_12_4','hc_8_3','sc_8_1','sc_1_1'])), {v,F}=L; const cr=o=>Object.assign({crit:true},o||{});
  const ra=(t)=>{ const h=t.hp, a=hitOn(L,v,t,1000,{crit:true}); t.hp=h; const b=plainHit(L,()=>hitOn(L,v,t,1000,{crit:true})); t.hp=h; return a/b; };
  near(ra(F[1]),1.10,'Ace in the Cuff: the first hit of the wave',1e-9); near(ra(F[1]),1,'only the first',1e-9);
  F[1]._markT=9; near(ra(F[1]),1.10,'Read the Table',1e-9); F[1]._markT=0;
  L.T.fn.sign(so(L).api,L.T,v,F[2]); near(ra(F[2]),1.09*1.075,'Old Signatures on a Signed enemy (and First Card Says Hello)',1e-9);
  so(L).suitHit=true; near(ra(F[1]),1.20,'Lucky Strike: his suits\' critical hits',1e-9); so(L).suitHit=false;
  L.T.s.fresh=true; V.step(1); near(ra(F[1]),1.10,'Ace in the Cuff: each wave',1e-9);
});

/* ======================= HONEST CARDS ======================= */
test('Sorrel / The Joker (1 draw in 5 replays the last suit, 4% x 5 stronger), Wild Odds (that share 3% x 3 more: 21.8%), Wild Pair (and a seeded other suit), Joker\'s Grin, Wild Chase, Deal Me In',()=>{
  const L=sl(S(['hc_1_1','hc_2_1','hc_3_1','hc_6_1','hc_11_1','hc_11_2'])), {v,F}=L; V.step(1); const i0=v.atkInterval;
  seq([0.6]); assert.deepEqual(played(()=>draw(L)),[2],'the first draw: no last suit, no Wild Card'); assert.equal(left(),0,'(no roll for it)');
  seq([0.21,0]); let s=[]; const sh=shredOf(L,F[0],()=>{ s=played(()=>draw(L)); }); assert.deepEqual(s,[2,0],'0.21 < 21.8%: the Wild Card plays the armour break again, and Wild Pair a heavy hit');
  near(sh,SH(L,1+0.20+0.15),'The Joker 20% + Joker\'s Grin 15%',1e-9); V.step(1); near(i0/v.atkInterval,1.15,'Wild Chase: 3% x 5 attack speed',1e-6);
  seq([0.22,0.1]); assert.deepEqual(played(()=>draw(L)),[0],'0.22: not a Wild Card'); secs(3.1); near(v.atkInterval,i0,'Wild Chase: 3 s',1e-6);
  setWin(L,'soHe'); seq([0]); assert.deepEqual(played(()=>draw(L)),[0,1],'Deal Me In: every draw in House Edge is a Wild Card (no roll; Wild Pair\'s other suit)'); assert.equal(left(),0);
});

test('Sorrel / Hot Hand (the same suit again: a Streak, max 4, suits 3% x 3 stronger each), Running Hot, Winning Streak, Charmed Coat, Never Goes Cold, Unbroken Run',()=>{
  const L=sl(S(['hc_1_4','hc_3_4','hc_5_4','hc_7_1','hc_7_4','hc_9_4'])), {v,F}=L; V.step(1); const i0=v.atkInterval, l0=v.lifestealStat||0;
  seq([0.6,0.6]); played(()=>draw(L)); played(()=>draw(L)); assert.equal(stk(L,'soStr'),1,'the same suit twice: Streak 1');
  V.step(1); near(i0/v.atkInterval,1.05,'Running Hot: 1% x 5 a Streak',1e-6); near((v.lifestealStat||0)-l0,0.02,'Winning Streak: 0.4% x 5 lifesteal a Streak',1e-9);
  near(ratio(L,F[0],v),1-0.075,'Charmed Coat: 1.5% x 5 less while he holds a Streak',1e-9);
  seq([0.6]); const sh=shredOf(L,F[0],()=>draw(L)); assert.equal(stk(L,'soStr'),2); near(sh,SH(L,1+0.09*2),'Hot Hand: the suit 3% x 3 x 2 stronger',1e-9);
  seq([0.1]); played(()=>draw(L)); assert.equal(stk(L,'soStr'),2,'another suit ends it: Never Goes Cold keeps 1 x 3 (here 2)');
  seq([0.1,0.1]); played(()=>draw(L)); played(()=>draw(L)); assert.equal(stk(L,'soStr'),4,'up to 4');
  seq([0.9]); assert.deepEqual(played(()=>draw(L)),[0,0,0],'Unbroken Run: at 4 the next draw plays that suit three times (no draw)'); assert.equal(left(),1);
  assert.equal(stk(L,'soStr'),3,'and spends the Streak (Never Goes Cold keeps 3)');
  V.step(1); near(i0/v.atkInterval,1.15,'',1e-6);
});

test('Sorrel / All or Nothing (4% x 5 to play twice, the same to play nothing), All In (both doubled), Ride the Next One (10% x 3 after nothing), Bust (15%, 3 s, his team), Fortune\'s Favourite',()=>{
  const L=sl(S(['hc_2_2','hc_4_2','hc_5_2','hc_6_2','hc_10_2'])), {v,F,A}=L; V.step(1); const a0=v.dmg;
  seq([0.6,0.39]); assert.deepEqual(played(()=>draw(L)),[2,2],'0.39 < 40%: twice'); V.step(1); near(v.dmg/a0,1.05,'Fortune\'s Favourite: 1% x 5 attack',1e-6);
  seq([0.6,0.79]); assert.deepEqual(played(()=>draw(L)),[],'0.79 < 80%: nothing');
  seq([0.6,0.81]); const sh=shredOf(L,F[0],()=>played(()=>draw(L))); near(sh,SH(L,1.30),'0.81: once; Ride the Next One: 10% x 3 stronger after nothing',1e-9);
  seq([0.6,0.85]); near(shredOf(L,F[0],()=>draw(L)),SH(L,1),'(only the next)',1e-9);
  seq([0.6,0.5]); played(()=>draw(L)); near(ratio(L,A[0],F[1]),1,'',1e-9); hitOn(L,v,F[1],10); near(ratio(L,A[0],F[1]),1.15,'Bust: the next enemy he hits takes 3% x 5 more from his team',1e-9); near(ratio(L,v,F[1]),1.15,'(him too)',1e-9);
  near(ratio(L,A[0],F[2]),1,'(only that one)',1e-9); secs(3.05); near(ratio(L,A[0],F[1]),1,'for 3 s',1e-9); secs(2.1); near(v.dmg/a0,1,'Fortune\'s Favourite: 5 s',1e-6);
});

test('Sorrel / Hedge the Bet (never nothing, twice halved: 10%), Safe Money (a double play heals 1% x 3, within the heal budget)',()=>{
  const L=sl(S(['hc_2_2','hc_5_3','hc_6_3'])), {v}=L; budget(L); low(v,0.5);
  seq([0.6,0.5]); assert.deepEqual(played(()=>draw(L)),[2],'0.5: once (never nothing)'); seq([0.6,0.099]); const h=v.hp; assert.deepEqual(played(()=>draw(L)),[2,2],'0.099 < 10%: twice');
  near(v.hp-h,0.03*v.maxHp,'Safe Money: 1% x 3 of his max HP',1e-6); seq([0.6,0.11]); assert.deepEqual(played(()=>draw(L)),[2],'0.11: once');
});

test('Sorrel / Lucky Seven (every 7th draw in a wave 10% x 3), Honest Hands (1% x 5 a different suit this wave, up to 5), Dealer\'s Choice (0.4% x 5 a suit played, up to 10), Gambler\'s Nerve, Dealer\'s Patience, Steady Breath',()=>{
  const L=sl(S(['hc_12_1','hc_12_2','sd_12_2','hc_4_3','sd_4_3','sc_4_3'])), {v,F}=L;
  const shs=[]; for(let i=0;i<7;i++){ seq([0.6]); shs.push(shredOf(L,F[0],()=>draw(L))); } near(shs[5],SH(L,1),'',1e-9); near(shs[6],SH(L,1.30),'the 7th draw: 30% stronger',1e-9);
  near(ratio(L,v,F[1]),1.05*(1+0.02*7),'one suit this wave (Honest Hands 5%); 7 suits played (Dealer\'s Choice 0.4% x 5 = 2% each)',1e-9);
  for(const x of [0.1,0.3,0.9,0.1]){ seq([x]); draw(L); } near(ratio(L,v,F[1]),1.20*1.20,'four suits (20%); 11 played (at most 10: 20%)',1e-9);
  L.T.s.fresh=true; V.step(1); near(ratio(L,v,F[1]),1,'a new wave',1e-9);
  v.energy=0; seq([0.6]); draw(L); near(v.energy,11*0.09,'Gambler\'s Nerve: the drawing swing 3% x 3 more of its 11',1e-9);
  v.energy=0; hitOn(L,v,F[1],10,{auto:true}); near(v.energy,11*0.09,'Dealer\'s Patience: a basic attack 3% x 3 more',1e-9); F[1]._markT=9; v.energy=0; hitOn(L,v,F[1],10,{auto:true}); near(v.energy,11*0.18,'Steady Breath: on a marked enemy 3% x 3 more',1e-9);
  v.energy=0; hitOn(L,v,F[1],10); near(v.energy,0,'(not a card)',1e-9);
});

/* ======================= SIGNED AND COLLECTED ======================= */
test('Sorrel / Signed (Marked Deal\'s marking card Signs its enemy until it dies), First Card Says Hello, Witnessed, Signed for the Team, Signed in Ink, Folded Cuff, Deadline, Collector\'s Nerve',()=>{
  const L=sl(S(['sc_1_1','sc_n1','sc_7_1','sc_6_1','sc_12_4','sc_10_1','sc_n2'])), {v,F,A}=L; V.step(1); const i0=v.atkInterval;
  green(L,F[0]); secs(0.5); assert.ok(!L.T.fn.tSigned(so(L).api,L.T,v,{tgt:F[0]}),'not before the marking card'); secs(0.4);
  assert.ok(L.T.fn.tSigned(so(L).api,L.T,v,{tgt:F[0]}),'Signed'); near(v.energy,5,'Collector\'s Nerve: 1 x 5 Energy',1e-9);
  F[0]._markT=0; V.step(1); near(ratio(L,v,F[0]),1.075*1.05*1.02,'First Card Says Hello 7.5%, Signed for the Team 5%, Witnessed 2% (even after the mark is gone)',1e-9);
  near(ratio(L,A[0],F[0]),1.05,'an ally: Signed for the Team',1e-9); near(ratio(L,v,F[1]),1.02,'another enemy: Witnessed only',1e-9);
  near(ratio(L,F[0],v),0.96,'Folded Cuff: 2% x 2 less from a Signed enemy',1e-9); near(ratio(L,F[1],v),1,'',1e-9);
  low(F[0],0.5); const h=F[0].hp; V.heal(F[0],1000); near(F[0].hp-h,880,'Signed in Ink: it receives 4% x 3 less healing',1e-6);
  V.step(1); near(i0/v.atkInterval,1.025,'Deadline: 0.5% x 5 a Signed enemy alive',1e-6);
  F[0].alive=false; V.step(2); near(v.atkInterval,i0,'(none alive)',1e-6); near(ratio(L,v,F[1]),1,'Witnessed: none',1e-9); F[0].alive=true;
});

test('Sorrel / Third Signs Them (the mark on a Signed enemy lasts 9 s), Countersign (and is 10% stronger), Witnessed\'s link (with Counting Cards a Signed enemy counts as 1 Count)',()=>{
  let L=sl(S(['sc_1_1','sc_3_1','sc_9_1'])), {v,F}=L; green(L,F[0]); secs(1); assert.ok(F[0]._markT<=6,'the first mark: 6 s'); near(F[0]._markMul,1.22,'',1e-9);
  F[0]._markT=0; green(L,F[0]); secs(1); assert.ok(F[0]._markT>8&&F[0]._markT<=9,'Signed already: 9 s ('+F[0]._markT+')'); near(F[0]._markMul,1+0.22*1.1,'x1.242',1e-9);
  L=sl(S(['sd_1_4','sc_n1'])); ({v,F}=L); setStack(L,'soCnt',1); L.T.fn.sign(so(L).api,L.T,v,F[0]); L.T.fn.sign(so(L).api,L.T,v,F[1]); V.step(1);
  near(L.T.fn.cntN(so(L).api,L.T,v),3,'1 Count + 2 Signed',1e-12); near(ratio(L,v,F[2]),1.09*1.02,'Counting Cards 1% x 3 x 3',1e-9);
  for(let i=0;i<4;i++) L.T.fn.sign(so(L).api,L.T,v,L.U.find(x=>x.team==='enemy'&&!L.T.fn.tSigned(so(L).api,L.T,v,{tgt:x}))||F[2]); setStack(L,'soCnt',4); V.step(1); near(L.T.fn.cntN(so(L).api,L.T,v),5,'(Count still caps at 5)',1e-12);
  L=sl(S(['sc_n1'])); ({v,F}=L); L.T.fn.sign(so(L).api,L.T,v,F[0]); setStack(L,'soCnt',1); V.step(1); near(L.T.fn.cntN(so(L).api,L.T,v),1,'without Counting Cards: no link',1e-12);
});

test('Sorrel / Markers: What\'s Owed (a Signed death: a Marker, max 3; the next Marked Deal throws a fourth card, 25% x 3), Fourth Card, Collector, Marker Paid, Called In, Interest, Good Coat, Saving the Last, Settling Up',()=>{
  const L=sl(S(['sc_1_4','sc_12_1','sc_3_4','sc_7_4','sc_9_4','sc_5_4','sc_4_1','sc_12_2','sc_11_1'])), {v,F}=L; budget(L); V.step(1); const a0=v.dmg, l0=v.lifestealStat||0; low(v,0.5); F[0]._markT=0;
  L.T.fn.sign(so(L).api,L.T,v,F[1]); F[1].hp=50; let h=v.hp; hitOn(L,v,F[1],1000); assert.ok(!F[1].alive,'a Signed enemy he kills');
  assert.equal(stk(L,'soMk'),1,'a Marker'); near(v.hp-h,0.05*v.maxHp,'Good Coat: 1% x 5',1e-6); V.step(1);
  near(v.dmg/a0,1.075,'Collector 1% x 5 a Marker, Saving the Last 0.5% x 5 (attack rows add)',1e-6); near((v.lifestealStat||0)-l0,0.05,'Settling Up: 1% x 5 lifesteal',1e-9);
  h=v.hp; let mp=0;
  const c=cards(L,F[0],()=>{ green(L,F[0]); mp=v.hp-h; },1.5); assert.equal(c.length,4,'four cards'); near(mp,0.06*v.maxHp,'Marker Paid: 2% x 3 as it is spent',1e-6);
  near(c[3]/c[0],0.75*1.30*1.22,'the fourth card: 25% x 3 of a card, Fourth Card 10% x 3 more (it lands after the mark: x1.22)',1e-6); assert.equal(stk(L,'soMk'),0,'spent');
  assert.ok(L.T.fn.tSigned(so(L).api,L.T,v,{tgt:F[2]})&&F[2]._markT>0,'Called In: the nearest other enemy Signed and marked');
  secs(5); near((v.lifestealStat||0)-l0,0,'Settling Up: 5 s',1e-9);
  /* Interest: a Marker held two waves */
  setStack(L,'soMk',0); so(L).mks=[]; F[2].hp=50; hitOn(L,v,F[2],1000); assert.equal(stk(L,'soMk'),1); for(let i=0;i<2;i++){ L.T.s.fresh=true; V.step(1); }
  F[0]._markT=0; const c2=cards(L,F[0],()=>green(L,F[0]),1.5); near(c2[3]/c2[0],0.75*1.30*1.22*(1+0.15*2),'Interest: 3% x 5 for each wave it was held',1e-6);
});

test('Sorrel / House Edge: House Advantage and Smell the End (its speed 3% x 5 stronger each), Run Them Down and Long Chase, Scent of Endings',()=>{
  let L=sl(S(['sd_10_2','sc_2_2','sc_5_2','sc_6_2','sc_4_2'])), {v,F}=L; const hm=VMX('skLvNum')('haste',v.blueAb,10);
  blue(L); near(v.hasteMul,1+(hm-1)*1.30,'the speed part 30% stronger',1e-9); assert.ok(win(L,'soHe'));
  F[0]._markT=9; F[1]._markT=9; F[2]._markT=9; F[0].hp=F[0].maxHp*0.9; F[1].hp=F[1].maxHp*0.5; F[2].hp=F[2].maxHp*0.2; V.step(1); assert.equal(v.forcedTarget,F[1],'Run Them Down: the lowest-HP marked enemy in his reach (F2 is beyond it)');
  const rg=v.range; v.range=6*V.METER; V.step(1); assert.equal(v.forcedTarget,F[0],'(in his reach)'); v.range=rg;
  const s0=v.speed; low(F[1],0.45); near(ratio(L,v,F[1]),1.12,'Scent of Endings: a marked enemy below 50% 4% x 3 more in House Edge',1e-9);
  secs(6.1); assert.ok(!win(L,'soHe')); V.step(1); assert.ok(!(v.forcedTargetT>0)||v.forcedTarget!==F[1],'after House Edge: his own pick again'); near(ratio(L,v,F[1]),1,'',1e-9);
  L=sl(S(['sc_5_2','sc_6_2'])); ({v,F}=L); V.step(1); const m0=v.speed; setWin(L,'soHe'); V.step(1); near(v.speed/m0,1.10,'Long Chase: 2% x 5 faster in House Edge',1e-6);
  L=sl(S(['sc_6_2'])); ({v}=L); V.step(1); const m1=v.speed; setWin(L,'soHe'); V.step(1); near(v.speed/m1,1,'(only while Run Them Down is chosen)',1e-6);
  L=sl(S(['sc_5_2'])); ({v,F}=L); v.forcedTarget=F[0]; v.forcedTargetT=3; F[2]._markT=9; setWin(L,'soHe'); V.step(1); assert.equal(v.forcedTarget,F[0],'never over a real taunt');
});

test('Sorrel / Wait Them Out (House Edge 3 s longer, but only while a marked enemy lives), Patient Fox (3% x 3 less while it holds)',()=>{
  let L=sl(S(['sc_5_3','sc_6_3'])), {v,F}=L; F[1]._markT=99; V.step(1); blue(L); near(v.hasteT,9,'9 s',1e-9);
  near(ratio(L,F[0],v),0.91,'Patient Fox: 9% less while a marked enemy lives',1e-9); secs(8); assert.ok(win(L,'soHe')&&v.hasteT>0.5,'it holds past 6 s while a marked enemy lives');
  L=sl(S(['sc_5_3','sc_6_3'])); ({v,F}=L); blue(L); V.step(1); near(ratio(L,F[0],v),1,'no marked enemy: no Patient Fox',1e-9); secs(5.5); assert.ok(win(L,'soHe')&&v.hasteT>0,'its own 6 s run');
  secs(1); assert.ok(!win(L,'soHe'),'then it ends'); assert.ok(!(v.hasteT>0.01),'the speed too');
});

test('Sorrel / Table Stakes (a card\'s overkill as Energy, 10% x 3 of it as a share of the enemy\'s max HP, up to 15), Everyone Signs (each ally that hits a Signed enemy, 1% x 3 to his next card on it), First Impression',()=>{
  let L=sl(S(['sd_n2'])), {v,F,A}=L; F[1].hp=F[1].maxHp*0.1; so(L).card={rec:{ult:true},i:0,e:F[1]}; V.hit(v,F[1],F[1].maxHp*0.3,tru()); so(L).card=null;
  assert.ok(!F[1].alive); near(v.energy,6,'20% of its max HP over: 6 Energy',1e-6); v.energy=0; F[2].hp=10; so(L).card={rec:{ult:true},i:0,e:F[2]}; V.hit(v,F[2],F[2].maxHp,tru()); so(L).card=null; near(v.energy,15,'up to 15',1e-9);
  const P0=sl(S(['sc_1_1'])); V.step(1); P0.T.fn.sign(so(P0).api,P0.T,P0.v,P0.F[0]); const pc=cards(P0,P0.F[0],()=>green(P0,P0.F[0]));
  L=sl(S(['sc_n3','sc_12_3','sc_1_1'])); ({v,F,A}=L); V.step(1);
  L.T.fn.sign(so(L).api,L.T,v,F[0]); hitOn(L,A[0],F[0],10); hitOn(L,A[1],F[0],10); hitOn(L,A[0],F[0],10);
  const c=cards(L,F[0],()=>green(L,F[0])); near(c[0]/pc[0],1.18*1.06,'his next card: First Impression 18% and Everyone Signs 3% x 2 allies',1e-6); near(c[1]/pc[1],1,'then neither',1e-6);
});

test('Sorrel / Long Deal (his reach 3% x 5), Poker Face (controls on him 4% x 5 shorter, at most 20%), Grin and Bear It, Lamp Flame, Bluff, Gambler\'s Mark',()=>{
  const L=sl(S(['sd_n1','hc_5_1','hc_12_3','sd_6_4','hc_11_3','hc_9_2'])), {v,F}=L; const ar=v.armorRating; V.step(1); near(v.range/so(L).rg0,1.15,'Long Deal',1e-9);
  near(VMX('TalentFx').cc(F[0],v,'stunned',1),0.80,'Poker Face: 20%',1e-9);
  low(v,0.49); V.step(1); near(v.armorRating/ar,1.06,'Grin and Bear It: 3% x 2 armour below 50%',1e-9); low(v,0.6); V.step(1); near(v.armorRating/ar,1,'',1e-9);
  near(ratio(L,F[0],v),1,'',1e-9); F[2]._markT=9; V.step(1); near(ratio(L,F[0],v),0.96,'Lamp Flame: 2% x 2 less while a marked enemy lives',1e-9);
  F[0]._markT=9; near(ratio(L,F[0],v),0.96*0.90,'Bluff: 2% x 5 less from a marked enemy',1e-9);
  so(L).suitHit=true; near(ratio(L,v,F[0]),1.03,'Gambler\'s Mark: his suits on a marked enemy 1% x 3 more',1e-9); near(ratio(L,v,F[1]),1,'',1e-9); so(L).suitHit=false; near(ratio(L,v,F[0]),1,'(not his other hits)',1e-9);
});

/* ======================= SIGNATURES ======================= */
test('Sorrel / Every Card He Ever Palmed (SIGNATURE): once every 20 s Grand Reveal\'s cards each land a heavy hit, a stun, an armour break and a heal; his palmed suits go out on the nearest card',()=>{
  const L=sl(S(['sd_13_2','sd_1_1'])), {v,F}=L; for(const f of F) free(f); so(L).palm=[{s:3,k:0}]; low(v,0.3); const h=v.hp;
  const pl=played(()=>{ ult(L); secs(0.5); }); assert.equal(pl.filter(x=>x===0).length,3,'a heavy hit on each card'); assert.equal(pl.filter(x=>x===2).length,3); assert.equal(pl.filter(x=>x===3).length,4,'a heal on each card, and the palmed heal');
  for(const f of F){ assert.ok(f.stunned>0,'stunned'); assert.ok(f._shredPct>0,'armour broken'); } assert.ok(v.hp>h); assert.equal(so(L).palm.length,0,'the sleeve emptied on the nearest card');
  for(const f of F){ f.stunned=0; f._shredPct=0; f._shredT=0; } secs(10); assert.deepEqual(played(()=>{ ult(L); secs(0.5); }),[],'not again within 20 s'); secs(5); assert.deepEqual(played(()=>{ ult(L); secs(0.5); }),[],'(16 s)');
  secs(4.5); assert.equal(played(()=>{ ult(L); secs(0.5); }).length,12,'after 20 s, again');
});

test('Sorrel / The Last Honest Hand (SIGNATURE): once every 20 s each Grand Reveal card draws its own suit at double strength, then his Streak goes to 4',()=>{
  const L=sl(S(['hc_13_2','hc_1_4'])), {v,F}=L; seq([0.6,0.6,0.6]); const sh=[]; ult(L); secs(0.5); for(const f of F) sh.push(f._shredPct);
  for(const s of sh) assert.ok(s>SH(L,2)-1e-9&&s<SH(L,2.5),'each card its own armour break, at double strength: '+s);
  assert.equal(stk(L,'soStr'),4,'Streak 4'); secs(1); seq([0.6,0.6,0.6]); for(const f of F) f._shredPct=0; ult(L); secs(0.5); for(const f of F) assert.ok(!(f._shredPct>0),'not again within 20 s');
});

test('Sorrel / The Stranger\'s Ace (SIGNATURE): once every 20 s a Signed enemy below 25% HP is finished (a boss takes 12% of its max HP) and he collects 3 Markers',()=>{
  const L=sl(S(['sc_13_2','sc_1_4'])), {v,F}=L; L.T.fn.sign(so(L).api,L.T,v,F[1]); L.T.fn.sign(so(L).api,L.T,v,F[2]); low(F[0],0.1); low(F[1],0.26); V.step(2); assert.ok(F[1].alive,'26%: not yet'); assert.ok(F[0].alive,'(not Signed)');
  low(F[1],0.24); V.step(1); assert.ok(!F[1].alive,'below 25%: finished'); assert.equal(stk(L,'soMk'),3,'3 Markers');
  low(F[2],0.2); secs(10); assert.ok(F[2].alive,'not again within 20 s'); F[2].t=Object.assign({},F[2].t,{isboss:true}); const h=F[2].hp; secs(10.1);
  near(h-F[2].hp,0.12*F[2].maxHp,'a boss: 12% of its max HP',1e-6); assert.ok(F[2].alive);
});

/* ======================= CAPS AND RULES ======================= */
test('Sorrel / his caps: damage reduction ONE group at most 25%, critical chance at most 5%, his talent heals within 1.2% of his max HP a second; the stun-lock rule for a talent\'s stun',()=>{
  const all=everything(H), L=sl(all), {v,F}=L; seq(Array(400).fill(0.999)); const f=F[0];
  f._markT=99; L.T.fn.sign(so(L).api,L.T,v,f); setStack(L,'soStr',2); setWin(L,'soHe'); V.step(1); near(ratio(L,f,v),0.75,'every reduction on him at once: held at 25%',1e-9);
  setStack(L,'soCnt',5); so(L).card={rec:{ult:false},i:0,e:f}; near(L.T.fn.critP(so(L).api,L.T,v,{tgt:f}),0.05,'every crit chance at once: 5%',1e-12); so(L).card=null;
  low(v,0.2); const o=so(L); o.rgV=0; o.rgAt=V.now(); secs(1); const h=v.hp; for(let i=0;i<5;i++) L.T.fn.heal(o.api,L.T,v,0.05*v.maxHp); near(v.hp-h,0.012*v.maxHp,'talent heals in a second: at most 1.2% of his max HP',0.05);
  const M=sl(S(['sd_1_1'])), A=so(M).api, x=M.F[1]; x.stunned=0.4; M.T.fn.play(A,M.T,M.v,x,1,0,{talent:true}); near(x.stunned,0.4,'a talent stun never lands on a stunned enemy',1e-9);
  x.stunned=0; M.T.fn.play(A,M.T,M.v,x,1,0,{}); const d=x.stunned; assert.ok(d>0,'his stun'); secs(d+0.25); free(x); M.T.fn.play(A,M.T,M.v,x,1,0,{talent:true}); assert.ok(!(x.stunned>0),'nor within 0.5 s after his stun on it ended');
  secs(0.3); M.T.fn.play(A,M.T,M.v,x,1,0,{talent:true}); assert.ok(x.stunned>0,'then it can');
  free(x); secs(1); const r={}; for(let i=0;i<3;i++){ x.stunned=0; so(M).st={}; M.T.fn.play(A,M.T,M.v,x,1,0,{talent:true,rec:r}); } assert.equal(r.sn[x.uid],2,'at most twice per cast');
  free(x); so(M).st={}; M.T.fn.play(A,M.T,M.v,x,1,0,{mul:40}); near(x.stunned,4.0,'a stun of his never above 4.0 s',1e-9);
});

test('Sorrel / across a wave (the clock starts again at 0): the signatures\' 20 s carry on, his stun-lock stamps move with the clock',()=>{
  const L=sl(S(['sd_13_2','sd_1_1'])), {v,F}=L; for(const f of F) free(f); ult(L); secs(0.5); assert.ok(so(L).sigA>19);
  secs(15); waveNext(L); V.step(1);
  assert.ok(so(L).sigA>4&&so(L).sigA<5.2,'its lock has the 5 s it had left ('+so(L).sigA+')');
  so(L).st={7:V.now()+0.2}; waveNext(L); assert.ok(so(L).st[7]<0.5,'a stamp moved back with the clock');
});

/* ======================= WHOLE FIGHTS ======================= */
test('Sorrel: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['sd_1_1','sd_1_4','sd_9_4','hc_1_1','hc_1_4','hc_2_2','sc_1_1','sc_1_4','sc_3_4','sc_n1','sd_5_2']), TEAM=['vael','sylthaine','vireo','vex','sorrel'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  let palm=0, cnt=0, str=0, sg=0, mk=0, draws=0, cardsN=0; const fpf=VMX('firePassiveFx'); VMX('var __sn={d:0}; var __sfp=firePassiveFx; firePassiveFx=function(u){ if(u&&u.key==="sorrel") __sn.d++; return __sfp.apply(this,arguments); };');
  try{ for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ V.step(1); const T0=s._tal.s, o=T0.so||{}; if(o.palm&&o.palm.length) palm++; if(T0.k.soCnt&&T0.k.soCnt.n>0) cnt++; if(T0.k.soStr&&T0.k.soStr.n>0) str++; if((o.sgN||0)>0) sg++; if(T0.k.soMk&&T0.k.soMk.n>0) mk++; if(o.cq) cardsN=Math.max(cardsN,o.cq.length); } }
  finally{ draws=VMX('__sn.d'); VMX('firePassiveFx=__sfp;'); }
  console.log('  live fight: draws '+draws+', ticks holding a palmed suit '+palm+', with Count '+cnt+', with a Streak '+str+', with a Signed enemy '+sg+', holding a Marker '+mk);
  assert.ok(draws>3&&palm>0&&cnt>0&&sg>0,'Loaded Hand, Palm, Count and Signed in a real fight');
  determinism(H,TEAM);
});

/* The page sites his talents added (Loaded Hand's swing, his cards' landing pair, the suit art): with nothing learned, whole seeded fights with Sorrel in the
   line-up are identical to the pre-talent page (ee8edab8), seed by seed. The counters show the fights reach every site. */
const BASE_SHA=process.env.TALENT_BASE||'ee8edab85c45b52cf17c71c5e4890e03deb753bc';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-')); TMP.push(dir);
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); return SH.load(path.join(dir,'emberweave-heroes.html')); }
let BASE=null; try{ BASE=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+') - the identity check against it is skipped'); }
test('Sorrel: no talents - whole fights with him in the line-up are identical to the pre-talent page, and they reach every site his talents added',{skip:!BASE},()=>{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['sorrel','vael','vireo','sylthaine','gruel'], foeTeam=['ambrel','dandra','konwu','rafe','vex'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>Object.assign(spec(k,70),{skillLv:[60,60,60,60]}))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __soN={draw:0,card:0,other:0}; var __soP=firePassiveFx, __soH=_dealDamageCore;'+
    'firePassiveFx=function(u){ if(u&&u.key==="sorrel") __soN.draw++; return __soP.apply(this,arguments); };'+
    '_dealDamageCore=function(src,tgt,amt,color){ if(src&&color==="#5ee89b"&&!_autoAtk){ if(src.key==="sorrel") __soN.card++; else __soN.other++; } return __soH.apply(this,arguments); };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>Object.assign(spec(k,68),{skillLv:[60,60,60,60]})))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'him on the other side, seed '+seed); n+=2; }
    const c=VMX('__soN'); console.log('  identity / sites reached: '+JSON.stringify(c));
    assert.ok(c.draw>20&&c.card>40&&c.other>5,'the fights reach Loaded Hand\'s draw and the volley landing (his cards and another hero\'s)'); }
  finally{ VMX('firePassiveFx=__soP; _dealDamageCore=__soH;'); }
  assert.ok(n>=18);
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and a build that sits at that ceiling (or is immune) for more than half a battle is too strong.
   His damage reduction talents (and armour / max HP), each candidate 91-point build legal; the most defensive one is the one whose worst hit is reduced most. */
const DEF={ sd:['sd_6_4','sd_4_1'], hc:['hc_7_1','hc_11_3','hc_12_3','hc_4_1','hc_1_4','hc_5_1'], sc:['sc_6_3','sc_12_4','sc_5_3','sc_1_1'] };
function defensive(order,caps){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={sd:0,hc:1,sc:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of DEF[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
/* the worst hit on him: every condition of his reduction talents true at once (a marked enemy alive and the attacker marked, Signed, a Streak, House Edge with Wait
   Them Out; normal and critical, physical and magic); sustained: a plain attacker, nothing on it, a basic attack of 5% of his max HP. Through the engine. */
function worstHit(list,kind,crit,sustained){ const L=sl(list,{allies:2,foes:3}), {v,F}=L; const f=F[0]; v.maxHp=1e5; v.hp=6e4; seq(Array(50).fill(0.999));
  if(L.T&&!sustained){ f._markT=999; F[1]._markT=999; L.T.fn.sign(so(L).api,L.T,v,f); setStack(L,'soStr',3); setWin(L,'soHe'); }
  V.step(1); v.shield=1e12; v.shieldT=999; for(const x of F) x.stunned=1e6; v.evaStat=0;
  const raw=sustained?5e3:2e4, x=lost(v,()=>V.hit(f,v,raw,{kind,crit,auto:!!sustained})), cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1; brndBack();
  return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Sorrel: his most defensive legal 91-point build never takes more than 95% off a hit, and never sits near that ceiling in a seeded fight',()=>{
  const cands=[[['hc','sc'],[61,30]],[['hc'],[91]],[['sc','hc'],[61,30]],[['sc'],[91]],[['hc','sd'],[61,30]],[['sd','hc'],[61,30]],[['sc','sd'],[61,30]],[['hc','sc','sd'],null]].map(([o,c])=>{ const b=defensive(o,c); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; for(const kind of ['magic','phys']) for(const crit of [false,true]) c.worst=Math.max(c.worst,worstHit(c.list,kind,crit,false));
    c.sus=Math.max(worstHit(c.list,'phys',false,true),worstHit(c.list,'magic',false,true)); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false))), noneS=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,true)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' worst '+(c.worst*100).toFixed(1)+'% sustained '+(c.sus*100).toFixed(1)+'%').join(' | '));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.90,'the worst possible hit on his most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 90%');
  VMX('var __dr={max:0,n:0,at:0,hi:0,ticks:0,imm:0,tHi:0,pr:[]}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="sorrel"&&src&&src.team!==tgt.team; let h0=0; if(me) h0=tgt.hp+(tgt.shield||0); const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive){ const l=h0-tgt.hp-(tgt.shield||0), raw=amt*elemMul(src,tgt); if(raw>0&&l>1e-6*raw){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(u&&u.key==="sorrel"&&u.alive){ __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++; const T=u._tal, e=units.find(x=>x.team!==u.team&&x.alive);'+
    '    const A=T&&T.s.so&&T.s.so.api; if(A&&e){ const k=T.fn.drK(A,T,u,{src:e,kind:"phys",auto:true,crit:false,probe:true}), d=1-k*Math.max(defMul(e,u,"phys"),defMul(e,u,"magic")); __dr.pr.push(d); if(d>=0.85) __dr.tHi++; } } } return __ubc.apply(this,arguments); };');
  try{ const sn=snaps(['vael','sylthaine','vireo','vex','sorrel'].map(k=>Object.assign(spec(k,100,k===H?best.list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','kharos','rafe','sloe','fritz'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13,21,34,55,89]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const d=VMX('__dr'); console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%), sustained '+(best.sus*100).toFixed(1)+'% (no talents '+(noneS*100).toFixed(1)+'%); seeded fights: '+d.n+' hits, the most reduced '+(d.max*100).toFixed(1)+'%, 85% or more '+d.hi+'; at the ceiling '+d.at+'; immune ticks '+d.imm+' of '+d.ticks+'; ticks at 85% or more (the probe: his group and his armour) '+d.tHi+', the probe median '+(d.pr.length?(d.pr.slice().sort((a,b)=>a-b)[d.pr.length>>1]*100).toFixed(1):'-')+'%, highest '+(d.pr.length?(Math.max(...d.pr)*100).toFixed(1):'-')+'%');
    assert.ok(d.n>20&&d.ticks>500,'hits on him: '+d.n);
    assert.ok(d.max<0.95,'no hit on him was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0); assert.equal(d.imm,0);
    assert.ok(d.hi<0.5*d.n,'above 85% for less than half of the hits'); assert.ok(d.tHi<0.5*d.ticks,'at 85% or more for less than half of the fight: '+d.tHi+' of '+d.ticks+' ticks'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});

/* his stuns in seeded fights: the longest time one enemy stays stunned in a row while he fights (any stun, and the runs his stuns are part of), for stun-heavy legal builds */
test('Sorrel: stun-heavy legal builds - the longest one enemy stays stunned in a row in seeded fights',()=>{
  const two=(a,na,b,ids)=>{ let x={r:{}}; const meta=id=>T.talent(H,id), tr=T.trees(H); const want=ids.slice();
    const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; }; const goals=[]; for(const id of want) for(const y of pre(id).concat([id])) if(goals.indexOf(y)<0) goals.push(y);
    for(let g=0;g<3000&&T.spent(H,x).total<91;g++){ const id=goals.find(y=>(x.r[y]|0)<meta(y).ranks&&T.canLearn(H,x,y,100)); if(id){ x=T.learn(H,x,id,100).build; continue; }
      const sp=T.spent(H,x).tree, ti=(sp[tr[a].id]||0)<na?a:b; const pool=tr[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,x,t[0],100)).sort((p,q)=>p[1]-q[1]||p[2]-q[2]); if(!pool[0]) break; x=T.learn(H,x,pool[0][0],100).build; }
    assert.equal(T.invalid(H,x,100),''); return T.learned(H,x); };
  const builds={'SD61 Clean Deck + Cooler / HC30':two(0,61,1,['sd_5_3','sd_9_1','sd_3_1','sd_1_1','sd_13_2','hc_6_4']),'HC61 / SD30 Clean Deck':two(1,61,0,['hc_6_4','hc_2_2','hc_5_2','hc_9_4','hc_13_2','sd_5_3']),'SD91':T.learned(H,(function(){ let b={r:{}}; const tr=T.trees(H)[0]; for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const nx=tr.talents.slice().sort((p,q)=>p[1]-q[1]||p[2]-q[2]).find(t=>T.canLearn(H,b,t[0],100)); if(!nx) break; b=T.learn(H,b,nx[0],100).build; } return b; })())};
  VMX('var __st={runs:[],mine:[]}; var __stU=_updateBattleCore, __stR=new Map();'+
    '_updateBattleCore=function(dt){ const r=__stU.apply(this,arguments); const s=units.find(u=>u&&u.key==="sorrel"); if(!s) return r;'+
    '  for(const e of units){ if(e.team===s.team) continue; const on=e.alive&&(e.stunned||0)>0, w=__stR.get(e)||{t:0,m:false}; const st=s._tal&&s._tal.s.so&&s._tal.s.so.st;'+
    '    if(on){ w.t+=dt; if(st&&st[e.uid]!=null&&st[e.uid]>=battleTime-1e-9) w.m=true; } else if(w.t>0){ __st.runs.push(w.t); if(w.m) __st.mine.push(w.t); w.t=0; w.m=false; } __stR.set(e,w); } return r; };');
  try{ const out=[]; for(const k in builds){ VMX('__st.runs=[]; __st.mine=[]; __stR=new Map();'); const sn=snaps(['sorrel','vael','vireo','sylthaine','gruel'].map(x=>Object.assign(spec(x,100,x===H?builds[k]:null),{skillLv:[100,100,100,100]})));
      for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
      const foe=snaps(['ambrel','carn','dandra','konwu','ceraline'].map(x=>Object.assign(spec(x,100),{skillLv:[100,100,100,100]}))); for(const seed of [5,77,31337,4242]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
      const c=VMX('__st'), mx=a=>a.length?Math.max(...a):0; out.push(k+': runs with a stun of his '+c.mine.length+', the longest '+mx(c.mine).toFixed(2)+' s (any stun: the longest '+mx(c.runs).toFixed(2)+' s)'); assert.ok(mx(c.mine)<=4.0+0.1,k+': '+mx(c.mine)); }
    console.log('  stun chains: '+out.join(' | ')); }
  finally{ VMX('_updateBattleCore=__stU;'); }
});
