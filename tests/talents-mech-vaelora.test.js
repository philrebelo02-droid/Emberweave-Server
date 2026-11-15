'use strict';
/* Vaelora Velvetclaw's talents as data on the mechanics layer (talents-mech/vaelora.js), group by group on the still field (tests/talents-lab.js), then whole
   fights, the no-talent identity with her in the line-up, her stun limits in seeded fights, and Phil's 95% damage-reduction ceiling.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with her talents switched off
   for one hit (plainHit) or in a plain lab built BEFORE the talented one: lab() replaces the whole field.
   Places (metres from Vaelora, centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0) F3 (0,6) F4 (5.5,6) F5 (11,6) F6 (0,12) F7 (5.5,12) F8 (11,12).
   Featherfang aims at the FARTHEST enemy: with 3 foes its line runs along y = 0 through F0, F1, F2 (in that order); F3 and up stand off it.
   Lab units are HELD (stunned 1e6), Vaelora too: a held Vaelora does not think (her untouched clock and her storm's channel stand still). go() lets her think
   without acting; free() frees the enemies (standing, not swinging) so a freeze of hers lands. Silent Altitude is put up with saUp() (3 s untouched).
   Lab skill level 10. Run: node --test tests/talents-mech-vaelora.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='vaelora', S=ids=>full(H,ids);
test.afterEach(()=>{ FX.define(H,null); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const VMX=s=>vm.runInContext(s,NOW.ctx);
const plain=(o,fn)=>fn(lab(H,null,o));
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const vl=L=>L.T.s.vl;
const recL=(L,t,o)=>{ const e=vl(L).e; let r=e[t.uid]; if(!r||r.u!==t) r=e[t.uid]={u:t,q:0,qt:0,qfl:0,st:0,re:0,lk:0,cap:0,fz:0,gr:0,lw:0,nl:null,sh:0}; return Object.assign(r,o||{}); };
const rq=(L,t)=>{ const r=vl(L).e[t.uid]; return (r&&r.u===t)?r:null; };
const qOn=(L,t)=>{ const r=rq(L,t); return (r&&r.qt>0)?r.q:0; };
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{},{n,t:99,idle:0}); };
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const hitOn=(L,amt,o)=>lost(L.v,()=>V.hit((o&&o.src)||L.F[0],L.v,amt||1000,Object.assign({kind:'true'},o||{})));   // an enemy's hit on her (true damage unless said)
const myHit=(L,t,o)=>lost(t,()=>V.hit(L.v,t,1000,Object.assign({kind:'true'},o||{})));
const go=L=>{ const v=L.v; v.stunned=0; v.speed=0; v.atkCd=1e9; v.greenCd=1e9; v.blueCd=1e9; v.energy=0; v.energyReg=0; v.target=null; };
const hold=L=>{ L.v.stunned=1e6; };
const free=L=>{ for(const f of L.F){ f.stunned=0; f.fearT=0; f.silencedT=0; f.level=1; f.ctrlRes=0; f.speed=0; f.atkCd=1e9; f.greenCd=1e9; f.blueCd=1e9; } };
const holdF=L=>{ for(const f of L.F){ f.stunned=1e6; } };
const saUp=L=>{ L.v._untouched=3; V.step(2); assert.ok(L.v._saOn,'Silent Altitude is up'); };
const castFF=(L,t)=>V.cast(L.v,'green',t||L.F[0]);
const castWP=L=>V.cast(L.v,'blue');
const castWS=(L,t)=>V.cast(L.v,'ult',t||L.F[0]);
const dmgOf=(t,fn)=>{ const h=t.hp+(t.shield||0); fn(); return h-t.hp-(t.shield||0); };
const api=L=>L.T.s.api;
const auOf=(L,x)=>L.T.s.au.find(e=>e.x===x);
const sm10=()=>VMX('skillMul(10)');
/* the page's own seeded draw held at x for fn (the storm's freeze roll and every chance row read it) */
const rndAt=(x,fn)=>{ VMX('var __vb0=brnd; brnd=function(){ return '+x+'; };'); try{ return fn(); } finally{ VMX('brnd=__vb0;'); } };
const ccOn=(src,t,field,s)=>{ const lv=t.level; t.level=1; try{ V.cc(src,t,field,s); } finally{ t.level=lv; } };

test('Vaelora: every talent is accounted for - 11 plain stats, 104 with rows, none waiting; crit chance 5% in all; crit damage at most 10% (20% on an ability)',()=>{
  accounting(H,[115,11,104,0,0]);
  for(const id of ['pc_1_3','pc_10_4','pc_7_1','pc_11_3','wc_11_2','wc_7_4','wc_10_2','tw_2_1','tw_12_1','tw_9_1','tw_8_4']) assert.ok(FXN.has(H,id),id+' is a plain stat');
  near(FXN.totals(H,[['pc_7_1',5]]).critDmg,0.10,'Snowfield Eyes 10%'); near(FXN.totals(H,[['tw_8_4',5]]).critDmg,0.10,'Feral 10%');
  assert.ok(/0\.2% critical chance per rank/.test(T.talent(H,'pc_1_1').text),'Stalk: 0.2% a Stalk a rank (5% at 5 x 5)');
  assert.ok(/2% more damage per rank/.test(T.talent(H,'pc_4_1').text)&&/2% more damage per rank/.test(T.talent(H,'pc_12_2').text),'Perfect Moment, Brittle Prey: 2% a rank (10%)');
  for(const id of ['pc_1_4','pc_6_1','pc_12_1','wc_4_1','tw_3_4','tw_6_2','tw_10_1']) assert.ok(/at most 25% off a hit/.test(T.talent(H,id).text),id+' states the 25% group cap');
  for(const id of ['wc_9_4','wc_13_3']) assert.ok(/already stunned/.test(T.talent(H,id).text),id+' states the stun-lock rule');
  const names={}; for(const tr of T.trees(H)) for(const t of tr.talents){ assert.ok(!names[t[3]],'a name used twice: '+t[3]); names[t[3]]=1; }
  for(const id of ['pc_13_2','wc_13_3','tw_13_3']) assert.ok(FXN.mech(H).talents[id],id);
});

test('Vaelora: her real kit, as the talents read it - Featherfang (the line to the farthest enemy), Whiteout Pounce (evade, counter on the attacker), Winter Plumage (0.5 s ticks, 0.84 s freezes), Silent Altitude',()=>{
  plain({foes:4,big:true},P=>{ const {v,F}=P; const h=F.map(f=>f.hp); castFF(P,F[0]);
    const d=F.map((f,i)=>h[i]-f.hp); assert.ok(d[0]>0&&d[1]>0&&d[2]>0,'Featherfang strikes every enemy on the line to the farthest one'); assert.equal(d[3],0,'(not one 6 m off it)');
    near(d[0],d[2],'each the same'); near(d[0],d[1],'');
    castWP(P); near(v._evadeT,2.2,'Whiteout Pounce: a 2.2 s evade window'); assert.ok(v.drMul<0.56&&v.drT>2.1,'and its stance\'s damage reduction ('+v.drMul+')');
    const hv=v.hp, h1=F[1].hp; V.hit(F[1],v,1000,{kind:'phys'}); assert.equal(v.hp,hv,'the first enemy hit inside it misses'); assert.ok(F[1].hp<h1,'and the counter strikes THAT attacker'); near(v._evadeT,0,'(spent)');
    const h2=F[2].hp; V.hit(F[2],v,1000,{kind:'phys'}); assert.ok(v.hp<hv,'(the next hit lands)'); assert.equal(F[2].hp,h2,'(no second counter)'); });
  plain({foes:3,big:true},P=>{ const {v,F}=P; go(P); free(P); castWS(P,F[0]); near(v._blizzT,4,'Winter Plumage: a 4 s channel');
    const h=F.map(f=>f.hp); secs(0.45); assert.equal(F[0].hp,h[0],'(no tick before 0.5 s)'); rndAt(0.05,()=>secs(0.1)); assert.ok(F[0].hp<h[0]&&F[1].hp<h[1],'a tick at 0.5 s: every enemy within 8 m of its spot');
    assert.equal(F[2].hp,h[2],'(not one 11 m from it)'); near(F[0].stunned,0.84,'a freeze (a 10% roll each tick): 0.84 s',0.08); });
  plain({foes:2,big:true},P=>{ const {v}=P; const c0=v.critDmg||0.6; v._untouched=3; V.step(1); near(v.critDmg,c0+0.5*v.passMul,'Silent Altitude: 3 s untouched, +50% x its strength critical damage');
    V.hit(P.F[0],v,1,{kind:'true'}); V.step(1); near(v.critDmg,c0,'any enemy hit spoils it'); });
});

/* ============================== SILENT ALTITUDE: STALK, SULK, KEPT HEIGHT ============================== */
test('Vaelora / Stalk: 1 a second while Silent Altitude holds (max 5), gone when it is spoiled; 0.2% crit each a rank; Waiting Game; Low and Still; Stalker\'s Eye',()=>{
  const P0=lab(H,null,{foes:2,big:true}), c0=P0.v.glyphCrit||0, ap0=P0.v.apow;
  const L=lab(H,S(['pc_1_1','pc_5_1','pc_2_1','pc_11_1']),{foes:2,big:true}), {v,F}=L; v._untouched=3; V.step(2); assert.equal(stack(L,'vlStalk'),0,'(none yet)');
  secs(1.0); assert.equal(stack(L,'vlStalk'),1,'1 after a second'); secs(5); assert.equal(stack(L,'vlStalk'),5,'max 5'); V.step(1);
  near((v.glyphCrit||0)-c0,0.05,'Stalk: 0.2% x 5 per Stalk = 5%'); near(v.apow,ap0*(1+0.025*5),'Waiting Game: 0.5% x 5 ability power per Stalk');
  F[0].mrRating=400; const m0=VMX('defMul')(v,F[0],'magic'); F[0].mrRating=400*0.9; const m1=VMX('defMul')(v,F[0],'magic'); F[0].mrRating=400;
  const p=plainHit(L,()=>myHit(L,F[0],{kind:'magic'})); near(myHit(L,F[0],{kind:'magic'}),p*m1/m0,'Stalker\'s Eye: at 5 Stalk her abilities ignore 2% x 5 of the magic resist');
  near(myHit(L,F[0],{kind:'magic',auto:true}),plainHit(L,()=>myHit(L,F[0],{kind:'magic',auto:true})),'(not her basic attacks)');
  V.hit(F[0],v,1,{kind:'true'}); assert.equal(stack(L,'vlStalk'),0,'a hit spoils Silent Altitude: Stalk gone at once'); V.step(2); near((v.glyphCrit||0)-c0,0,'(and its crit)');
  const S2=lab(H,S(['pc_2_1']),{foes:2,big:true}); go(S2); S2.v._untouched=0; secs(2.0); assert.ok(!S2.v._saOn,'Low and Still: not at 2.0 s'); secs(0.2); assert.ok(S2.v._saOn,'Silent Altitude up at 2.1 s (3 - 0.3 x 3)');
  const S0=lab(H,null,{foes:2,big:true}); go(S0); S0.v._untouched=0; secs(2.5); assert.ok(!S0.v._saOn,'(without it: not at 2.5 s)');
});

test('Vaelora / Sulk: a spoil Sulks her 3 s (Long Sulk longer): 3% x rank less damage, her next Featherfang 3% x rank more; Spoiled Mood, Pout, Long Grudge, Cat\'s Grudge, Sulking Strike',()=>{
  const P0=lab(H,null,{foes:3,big:true}), ai0=P0.v.atkInterval;
  const L=lab(H,S(['pc_1_4','pc_3_4','pc_5_4','pc_8_4','pc_12_4','pc_6_4','pc_9_4']),{foes:3,big:true}), {v,F}=L; v.maxHp=1e6; v.hp=5e5;
  const p=plainHit(L,()=>hitOn(L,1000)); near(hitOn(L,1000),p,'(no Sulk while Silent Altitude is down)');
  saUp(L); v.greenCd=4; v.hp=5e5; V.hit(F[1],v,1,{kind:'true'}); near(vl(L).sulk,3+0.4*5,'a spoil: Sulk for 3 + 0.4 x 5 s'); near(v.hp,5e5-1+1e6*0.03,'Pout: 1% x 3 of her max HP',1e-6);
  near(v.greenCd,4-1.5,'Long Grudge: Featherfang 0.5 x 3 s sooner'); near(hitOn(L,1000),p*0.91,'Sulk: 3% x 3 less damage'); V.step(1); near(v.atkInterval,ai0/1.10,'Spoiled Mood: 2% x 5 faster');
  near(myHit(L,F[1]),1000*1.10,'Cat\'s Grudge: the spoiler takes 2% x 5 more from her'); near(myHit(L,F[2]),1000,'(not another)'); secs(4.1); near(myHit(L,F[1]),1000,'(for 4 s)');
  holdF(L); const ff=plainHit(L,()=>dmgOf(F[0],()=>castFF(L))); vl(L).sulkFF=1; near(dmgOf(F[0],()=>castFF(L)),ff*1.09,'her next Featherfang: 3% x 3 more'); near(dmgOf(F[0],()=>castFF(L)),ff,'(only the next)');
  secs(1.0); assert.ok(!(vl(L).sulk>0),'Sulk over'); assert.ok(vl(L).ss,'Sulking Strike: armed when Sulk ends'); near(hitOn(L,1000),p,'(no less damage after it)');
  const c=myHit(L,F[2],{auto:true,crit:false}); assert.ok(c>1000*1.5,'her next basic attack is a critical hit ('+c+')'); near(myHit(L,F[2],{auto:true}),1000,'(only the next)');
});

test('Vaelora / Kept Height (the first spoil each 10 s does not, Stalk kept), Silent Pounce (evaded hits do not spoil; the counter always a critical), Second Strike, Hunting Ground, Perfect Moment',()=>{
  const L=lab(H,S(['pc_3_1','pc_1_1','pc_1_4']),{foes:3,big:true}), {v,F}=L; saUp(L); secs(3.1); const s0=stack(L,'vlStalk'); assert.ok(s0>=3,'');
  V.hit(F[0],v,1,{kind:'true'}); V.step(1); assert.ok(v._saOn,'Kept Height: the first spoil does not'); assert.ok(stack(L,'vlStalk')>=s0,'and Stalk is kept'); assert.ok(!(vl(L).sulk>0),'(no Sulk)');
  secs(2); V.hit(F[0],v,1,{kind:'true'}); V.step(1); assert.ok(!v._saOn,'a second within 10 s spoils it'); assert.ok(vl(L).sulk>0,'');
  saUp(L); secs(8.5); V.hit(F[0],v,1,{kind:'true'}); V.step(1); assert.ok(v._saOn,'10 s after the first: kept again');
  const P=lab(H,S(['pc_7_2','pc_1_4']),{foes:3,big:true}); saUp(P); castWP(P); const h1=P.F[1].hp; V.hit(P.F[1],P.v,1000,{kind:'phys'}); V.step(1);
  assert.ok(P.v._saOn,'Silent Pounce: the hit Whiteout Pounce evades does not spoil it'); const ctr=h1-P.F[1].hp;
  const Q=lab(H,S(['pc_1_4']),{foes:3,big:true}); saUp(Q); castWP(Q); const g1=Q.F[1].hp; V.hit(Q.F[1],Q.v,1000,{kind:'phys'}); V.step(1); assert.ok(!Q.v._saOn,'(without it the evaded hit spoils it)');
  const ctr0=g1-Q.F[1].hp; assert.ok(ctr>ctr0*1.4,'and the counter is a critical hit ('+ctr+' against '+ctr0+')');
  const K=lab(H,S(['pc_10_1']),{foes:3,big:true}); V.hit(K.F[0],K.v,1,{kind:'true'}); K.F[0].hp=10; K.F[0].shield=0; V.hit(K.v,K.F[0],1000,{kind:'true',crit:true}); assert.ok(!K.F[0].alive,'');
  near(K.v._untouched,3,'Second Strike: a kill with a critical hit - Silent Altitude returns at once',1e-6); V.step(1); assert.ok(K.v._saOn,'');
  K.F[1].hp=10; K.F[1].shield=0; V.hit(K.F[1],K.v,1,{kind:'true'}); V.hit(K.v,K.F[1],1000,{kind:'true'}); near(K.v._untouched,0,'(not a kill without a critical)',1e-6);
  const G=lab(H,S(['pc_8_1','pc_4_1']),{foes:2,big:true}); const c0=G.v.critDmg||0.6; saUp(G); V.step(1); near(G.v.critDmg,c0+0.5*G.v.passMul*1.12,'Hunting Ground: Silent Altitude\'s bonus 4% x 3 larger');
  const cr=myHit(G,G.F[0],{crit:true}), cr0=plainHit(G,()=>myHit(G,G.F[0],{crit:true})); near(cr,cr0*1.10,'Perfect Moment: crits while it holds 2% x 5 more');
  V.hit(G.F[0],G.v,1,{kind:'true'}); V.step(2); near(G.v.critDmg,c0,'all of it gone with the passive'); near(myHit(G,G.F[0],{crit:true}),plainHit(G,()=>myHit(G,G.F[0],{crit:true})),'(Perfect Moment too)');
});

test('Vaelora / Barbed Patience (LINK): Featherfang\'s cooldown 5% faster while Silent Altitude holds; with Quills a critical Featherfang leaves 2 Quills',()=>{
  const L=lab(H,S(['pc_n1']),{foes:3,big:true}), {v}=L; go(L); v.greenCd=5; secs(1); const d0=5-v.greenCd; near(d0,1,'(down: 1 s in 1 s)',0.02);
  v._untouched=3; V.step(2); v.greenCd=5; secs(1); near(5-v.greenCd,1.05,'while Silent Altitude holds: 1.05 s in 1 s',0.02);
  const Q=lab(H,S(['pc_n1','wc_1_4']),{foes:3,big:true}); VMX('var __vk=_preCrit;'); castFF(Q); assert.equal(qOn(Q,Q.F[0]),1,'a Featherfang: 1 Quill');
  const N=lab(H,S(['pc_n1','wc_1_4','pc_5_2']),{foes:3,big:true}); castFF(N); assert.equal(qOn(N,N.F[0]),2,'its critical hit (First Feather here): 2 Quills'); assert.equal(qOn(N,N.F[1]),1,'(not a critical: 1)');
  const W=lab(H,S(['pc_n1','pc_5_2','wc_2_4']),{foes:3,big:true}); castFF(W); assert.equal(qOn(W,W.F[0]),1,'(without Quills learned the link\'s second half does nothing: Barbed Quills\' Quills are 1)');
});

/* ============================== FEATHERFANG ============================== */
test('Vaelora / Featherfang: First Feather and Last Feather (path order), Featherfang Edge, Far Throw, Clean Kill, Ice Claw, Heavy Ring, Frost Fang',()=>{
  let p=0; plain({foes:3,big:true},P=>{ p=dmgOf(P.F[1],()=>castFF(P)); });
  const L=lab(H,S(['pc_5_2','pc_2_2']),{foes:3,big:true}), {F}=L; const h=F.map(f=>f.hp); castFF(L); const d=F.map((f,i)=>h[i]-f.hp);
  assert.ok(d[0]>p*1.5,'First Feather: the first enemy on its path takes a critical hit ('+d[0]+')'); near(d[1],p,'(the others: not)'); near(d[2],p,'');
  near(d[0],p*(1+(L.v.critDmg||0.6))*1.20,'Featherfang Edge: its crit 4% x 5 more',1e-6);
  const M=lab(H,S(['pc_5_3']),{foes:3,big:true}), g=M.F.map(f=>f.hp); castFF(M); const e=M.F.map((f,i)=>g[i]-f.hp); near(e[0],p,'Last Feather: the first as it was'); near(e[1],p*1.10,'the second 10% more'); near(e[2],p*1.20,'the third 20% more');
  const X=lab(H,S(['pc_4_2','pc_9_2','tw_6_1','wc_2_2']),{foes:3,big:true}), x=X.F; x[0].maxHp=x[1].maxHp=x[2].maxHp=1e9; x[1].hp=4.5e8; x[2].hp=3.5e8; const xh=x.map(f=>f.hp); castFF(X); const xd=x.map((f,i)=>xh[i]-f.hp);
  near(xd[0],p*1.15*1.0,'Heavy Ring 3% x 5 (F0 is 2.9 m away: no Far Throw)',1e-6); near(xd[1],p*1.15*1.09*1.18,'F1 at 45%: Far Throw 3% x 3 (more than 6 m away) and Ice Claw 6% x 3 (below 50%)',1e-6);
  near(xd[2],p*1.15*1.09*1.18*1.15,'F2 at 35%: and Clean Kill 3% x 5 (below 40%)',1e-6);
  const C=lab(H,S(['tw_11_4']),{foes:3,big:true}); castWP(C); V.hit(C.F[1],C.v,1000,{kind:'phys'}); const ch=C.F.map(f=>f.hp); castFF(C); near(ch[1]-C.F[1].hp,p*1.12,'Frost Fang: 4% x 3 more on the enemy the counter last struck'); near(ch[0]-C.F[0].hp,p,'(not another)');
});

test('Vaelora / Featherfang: The Long Wait (at 5 Stalk, each further second 2% a rank, up to 5 s, spent on the throw), Moult (20 feathers: 40% more, 3 Quills)',()=>{
  let p=0; plain({foes:3,big:true},P=>{ p=dmgOf(P.F[1],()=>castFF(P)); });
  const L=lab(H,S(['pc_n2','pc_1_1']),{foes:3,big:true}), {F}=L; saUp(L); secs(5.1); assert.equal(stack(L,'vlStalk'),5,''); secs(3.0); near(vl(L).lws,3,'3 s at 5 Stalk');
  secs(4.0); near(vl(L).lws,5,'up to 5 s'); near(dmgOf(F[1],()=>castFF(L)),p*1.50,'its next Featherfang 2% x 5 x 5 more'); near(dmgOf(F[1],()=>castFF(L)),p,'(spent on that throw)');
  const M=lab(H,S(['wc_11_1','wc_10_1','wc_1_1','wc_1_4']),{foes:3,big:true}); setStack(M,'vlFea',19); near(dmgOf(M.F[1],()=>castFF(M)),p,'Moult: not at 19 feathers');
  setStack(M,'vlFea',20); recL(M,M.F[1],{q:0,qt:0}); near(dmgOf(M.F[1],()=>castFF(M)),p*1.40,'at 20 the next Featherfang spends them all: 40% more'); assert.equal(stack(M,'vlFea'),3,'(spent: 0, then its 3 frost hits grow 3)');
  for(const f of M.F) assert.equal(qOn(M,f),3,'and gives 3 Quills to every enemy it hits');
});

test('Vaelora / Featherfang: Cold Ring (slow 4% a rank, 2 s), Biting Ring, Wide Ring, Owl\'s Return, Twin Rings, Finishing Ring',()=>{
  let p=0; plain({foes:3,big:true},P=>{ p=dmgOf(P.F[1],()=>castFF(P)); });
  const L=lab(H,S(['wc_3_3','wc_4_3']),{foes:3,big:true}), {F}=L; free(L); const d=dmgOf(F[1],()=>castFF(L)); near(F[1].slow,2,'Cold Ring: 2 s'); near(F[1].slowMul,0.80,'4% x 5 slower');
  near(d,p*1.18,'Biting Ring: the slow lands as it strikes - 6% x 3 more on every enemy it slows');
  const W=lab(H,S(['wc_4_2']),{foes:4,big:true}); at(W,W.F[3],10,1.4); const hw=W.F[3].hp; castFF(W); assert.ok(W.F[3].hp<hw,'Wide Ring: 1.2 x 1.24 m wide reaches an enemy 1.4 m off the line');
  plain({foes:4,big:true},P=>{ at(P,P.F[3],10,1.4); const h=P.F[3].hp; castFF(P); assert.equal(P.F[3].hp,h,'(1.2 m: not without it)'); });
  const R=lab(H,S(['wc_5_3']),{foes:3,big:true}); near(dmgOf(R.F[1],()=>castFF(R)),p*1.5,'Owl\'s Return: every enemy it hit takes half of that hit again');
  const Tw=lab(H,S(['wc_5_4']),{foes:5,big:true}); at(Tw,Tw.F[3],10,10*Math.tan(15*Math.PI/180)); at(Tw,Tw.F[4],10,-6);
  const th=Tw.F.map(f=>f.hp); castFF(Tw); const td=Tw.F.map((f,i)=>th[i]-f.hp);
  near(td[1],p*0.6,'Twin Rings: the first ring 60%'); near(td[3],p*0.6,'the second ring 15 degrees off the first, toward the side with more enemies, 60%',1e-6); assert.equal(td[4],0,'(nothing on the other side)');
  const Fi=lab(H,S(['tw_7_1']),{foes:3,big:true}), f=Fi.F; f[0].hp=10; f[0].shield=0; f[2].hp=5e8; const fh=f.map(x=>x.hp); castFF(Fi); assert.ok(!f[0].alive,'Featherfang kills');
  const d1=fh[2]-f[2].hp; V.step(1); const d2=fh[2]-f[2].hp-d1; near(d2,p,'Finishing Ring: thrown again at once at the enemy with the lowest HP (F2), a full Featherfang',1e-6);
  V.step(3); near(fh[2]-f[2].hp,d1+d2,'(once per cast)');
});

/* ============================== QUILLS ============================== */
test('Vaelora / Quills: from Featherfang (max 3, 8 s after the last; Barbed Quills longer), 2% a rank more frost damage each; Ice in the Barbs; Frost Paws; Quilled Through; Ice Barbs; Cold That Keeps',()=>{
  let p=0; plain({foes:3,big:true},P=>{ p=dmgOf(P.F[1],()=>castFF(P)); });
  const L=lab(H,S(['wc_1_4','wc_2_4','wc_6_4','wc_n1']),{foes:3,big:true}), {F}=L; castFF(L); assert.equal(qOn(L,F[1]),1,'each enemy Featherfang passes through: 1 Quill');
  near(dmgOf(F[1],()=>castFF(L)),p*1.10,'the next Featherfang: 2% x 5 more for its 1 Quill'); near(dmgOf(F[1],()=>castFF(L)),p*1.20,'(2 Quills: 20%)'); castFF(L); assert.equal(qOn(L,F[1]),3,'max 3');
  near(myHit(L,F[1]),1000,'(not her hits that are not frost: a basic attack)'); near(myHit(L,F[1],{frost:true}),1000,'(nor a frost hit that is not one of her frost skills)');
  V.step(1); const e=auOf(L,F[1]); near(e&&e.ap.move,1-0.15,'Quilled Through: an enemy carrying 3 Quills moves 3% x 5 slower');
  secs(8+3-0.2); assert.equal(qOn(L,F[1]),3,'they melt 8 + 1 x 3 s after the last'); secs(0.4); assert.equal(qOn(L,F[1]),0,'');
  recL(L,F[0],{q:3,qt:5}); F[0].stunImmune=true; near(dmgOf(F[0],()=>castFF(L)),p*1.30*1.10,'Cold That Keeps: an enemy that cannot be frozen with 3 Quills, 2% x 5 more frost damage');
  const B=lab(H,S(['wc_1_4','wc_8_4']),{foes:3,big:true}); rndAt(0.59,()=>castFF(B)); assert.equal(qOn(B,B.F[0]),2,'Ice in the Barbs: a 20% x 3 roll - 2 Quills'); const B2=lab(H,S(['wc_1_4','wc_8_4']),{foes:3,big:true}); rndAt(0.61,()=>castFF(B2)); assert.equal(qOn(B2,B2.F[0]),1,'(the roll failed: 1)');
  const Pw=lab(H,S(['wc_12_4']),{foes:3,big:true}); rndAt(0.44,()=>V.hit(Pw.v,Pw.F[0],10,{auto:true})); assert.equal(qOn(Pw,Pw.F[0]),1,'Frost Paws: a basic attack, a 15% x 3 roll - a Quill'); rndAt(0.46,()=>V.hit(Pw.v,Pw.F[1],10,{auto:true})); assert.equal(qOn(Pw,Pw.F[1]),0,'');
  const I=lab(H,S(['wc_11_4']),{foes:3,allies:1,big:true}); recL(I,I.F[0],{q:2,qt:5}); const ally=I.A[0];
  near(lost(I.F[0],()=>V.hit(ally,I.F[0],1000,{kind:'true'})),1000*1.05,'Ice Barbs: her ally\'s hit on an enemy with 2 Quills 0.5% x 5 x 2 more'); near(myHit(I,I.F[0]),1000,'(not her own)');
  near(lost(I.F[1],()=>V.hit(ally,I.F[1],1000,{kind:'true'})),1000,'(an enemy with none)');
});

test('Vaelora / Quill Freeze (the 3rd Quill freezes 0.8 s, once per enemy every 8 s, the stun-lock rule) and Torn Out (the counter tears out every Quill: 0.3x ability power each)',()=>{
  const L=lab(H,S(['wc_1_4','wc_9_4','wc_8_4']),{foes:3,big:true}), {F}=L; free(L); recL(L,F[0],{q:2,qt:5}); F[1].stunned=0.3; recL(L,F[1],{q:2,qt:5}); recL(L,F[2],{q:2,qt:5,lk:0.2});
  rndAt(0.99,()=>castFF(L)); near(F[0].stunned,0.8,'Quill Freeze: its 3rd Quill - frozen 0.8 s',1e-9); near(F[1].stunned,0.3,'(not one already stunned)',1e-9); near(F[2].stunned,0,'(nor within 0.5 s after her stun on it)',1e-9);
  free(L); rq(L,F[0]).q=2; rndAt(0.99,()=>castFF(L)); near(F[0].stunned,0,'once per enemy every 8 s',1e-9); free(L); secs(8.05); rq(L,F[0]).q=2; rq(L,F[0]).qt=5; rq(L,F[0]).lk=0; rndAt(0.99,()=>castFF(L)); near(F[0].stunned,0.8,'again after 8 s',1e-9);
  const P0=lab(H,null,{foes:3,big:true}); castWP(P0); const c0=dmgOf(P0.F[1],()=>V.hit(P0.F[1],P0.v,1000,{kind:'phys'}));
  const O=lab(H,S(['wc_3_4','wc_1_4']),{foes:3,big:true}); recL(O,O.F[1],{q:3,qt:5}); castWP(O); const mm=VMX('defMul')(O.v,O.F[1],'magic');
  const c=dmgOf(O.F[1],()=>V.hit(O.F[1],O.v,1000,{kind:'phys'})); near(c,c0*1.30+0.3*O.v.apow*3*mm,'Torn Out: the counter (with its 3 Quills\' 2% x 5 each) and 0.3x her ability power for each Quill (magic resist applies)',1e-6);
  assert.equal(qOn(O,O.F[1]),0,'every Quill torn out');
});

/* ============================== FEATHERS ============================== */
test('Vaelora / Plumage: 1 feather each frost hit (a storm tick once), max 20, 0.1% ability power each a rank; Shed Feathers; White Mantle; Fluffed Up; Full Plumage; Moulting and Preening at each wave',()=>{
  const P0=lab(H,null,{foes:3,big:true}), ap0=P0.v.apow, mr0=P0.v.mrRating;
  const L=lab(H,S(['wc_1_1','wc_3_1','wc_4_1','wc_6_1','wc_2_1','wc_10_1']),{foes:3,big:true,cold:true}), {v,F}=L; V.step(1); L.T=v._tal; assert.equal(stack(L,'vlFea'),6,'Moulting: the first wave starts with 2 x 3');
  castFF(L); assert.equal(stack(L,'vlFea'),9,'Featherfang: 1 for each enemy it hits (3)'); castWP(L); V.hit(F[0],v,1000,{kind:'phys'}); assert.equal(stack(L,'vlFea'),10,'the counter: 1');
  V.hit(v,F[0],10,{auto:true}); assert.equal(stack(L,'vlFea'),10,'(a basic attack: none)');
  go(L); castWS(L,F[0]); secs(0.55); assert.equal(stack(L,'vlFea'),11,'a storm tick (2 enemies inside): 1'); hold(L);
  setStack(L,'vlFea',19); V.step(1); near(v.apow,ap0*(1+0.005*19),'0.1% x 5 ability power each'); near(v.mrRating,mr0*1.15,'White Mantle: 1% x 5 magic resist each 5 (3)');
  const p=plainHit(L,()=>hitOn(L,1000)); near(hitOn(L,1000),p*(1-0.025*3),'Fluffed Up: 0.5% x 5 damage reduction each 5');
  holdF(L); const f0=plainHit(L,()=>dmgOf(F[1],()=>castFF(L))); setStack(L,'vlFea',20); near(dmgOf(F[1],()=>castFF(L)),f0*1.09,'Full Plumage: at 20 her frost hits 3% x 3 more'); assert.equal(stack(L,'vlFea'),20,'max 20');
  for(let i=0;i<5;i++) castFF(L); V.wave(); V.step(1); assert.equal(stack(L,'vlFea'),9+6,'a new wave: Preening keeps 3 x 3, Moulting adds 2 x 3');
  const Sh=lab(H,S(['wc_1_1','wc_8_1']),{foes:3,big:true}); go(Sh); at(Sh,Sh.F[2],8,3); castWS(Sh,Sh.F[0]); secs(0.55); assert.equal(stack(Sh,'vlFea'),3,'Shed Feathers: a tick on 3 enemies grows 1 for each (up to 1 + 1 x 3)');
  const Mo=lab(H,S(['wc_11_1','wc_1_1']),{foes:3,big:true}); setStack(Mo,'vlFea',20); castFF(Mo);
  assert.ok(stack(Mo,'vlFea')<20,'Moult: a throw at 20 feathers sheds them (the hits then regrow)');
});

/* ============================== WINTER PLUMAGE ============================== */
test('Vaelora / Winter Plumage: Feather Storm, Rime Wings, Hunting Storm, Feather Weight, Frozen Patience, Wide Storm',()=>{
  const L=lab(H,S(['pc_7_3','wc_8_3','tw_7_2','wc_12_3','wc_1_4','pc_11_2','pc_8_3']),{foes:3,big:true}), {v,F}=L; go(L); castWS(L,F[0]);
  const t0=plainHit(L,()=>dmgOf(F[0],()=>secs(0.55))); F[0].maxHp=1e9; F[0].hp=4e8; recL(L,F[0],{q:2,qt:9});
  const t1=dmgOf(F[0],()=>secs(0.5)); near(t1,t0*1.15*1.15*1.15*1.10*1.20,'Feather Storm 3% x 5, Rime Wings 3% x 5, Hunting Storm 3% x 5 (below 50%), Feather Weight 1% x 5 per Quill (2), Quills 2% x 5 each',1e-6);
  near(FX.num(v,'blizzR',8*V.METER),9*V.METER,'Wide Storm: the circle 8 m + 0.2 x 5'); assert.equal(vl(L).st.R,9*V.METER,'(its circle)');
  v._untouched=3; V.step(2); const t2=dmgOf(F[0],()=>secs(0.5)); near(t2,t1*1.12,'Frozen Patience: while Silent Altitude holds, its ticks 4% x 3 more',1e-6);
  plain({foes:3,big:true},P=>{ go(P); free(P); V.step(3); P.F[2].x=P.F[0].x; P.F[2].y=P.F[0].y+8.5*V.METER; castWS(P,P.F[0]); const h=P.F[2].hp; secs(0.55); assert.equal(P.F[2].hp,h,'(not without Wide Storm: a foe 8.5 m out takes no tick)'); });
});

test('Vaelora / freezes: Frozen Through (0.1 s a rank longer), Winter Hunt (the lowest-HP enemy inside, 2% a rank more often), Brittle Prey (2% a rank more critical damage on an enemy the storm froze), Owl\'s Gift, Late Winters',()=>{
  const L=lab(H,S(['wc_9_3','pc_12_2','wc_10_3','wc_1_4','wc_7_1']),{foes:3,big:true}), {v,F}=L; go(L); free(L); castWS(L,F[0]); rndAt(0.05,()=>secs(0.55));
  near(F[0].stunned,0.84+0.5,'Frozen Through: 0.84 + 0.1 x 5 s',0.08); assert.ok(rq(L,F[0]).fz>0,'(frozen by the storm)'); assert.equal(qOn(L,F[0]),1,'Owl\'s Gift: its 1st tick on an enemy, 1 Quill');
  const cr=myHit(L,F[0],{crit:true}), cr0=plainHit(L,()=>myHit(L,F[0],{crit:true})); near(cr,cr0*1.10,'Brittle Prey: her critical hits on it 2% x 5 more'); near(myHit(L,F[2],{crit:true}),plainHit(L,()=>myHit(L,F[2],{crit:true})),'(not an enemy it did not freeze)');
  F[0].energy=10; secs(0.5); const e0=F[0].energy; F[0].energy+=20; V.step(1); near(F[0].energy,e0+20*0.90,'Late Winters: an enemy the storm hit gains energy 2% x 5 slower',1e-6);
  rndAt(0.99,()=>secs(2.5)); assert.equal(qOn(L,F[0]),3,'Owl\'s Gift: its 4th and 7th tick, 2 Quills more (3 x 1)');
  const W=lab(H,S(['tw_11_3']),{foes:3,big:true}); go(W); free(W); W.F[1].hp=W.F[1].maxHp*0.2; castWS(W,W.F[0]); rndAt(0.1095,()=>secs(0.55));
  near(W.F[1].stunned,0.84,'Winter Hunt: the lowest-HP enemy inside freezes at a roll of 0.1095 (10% x 1.10)',0.08); near(W.F[0].stunned,0,'(the others still at 10%)');
  const B=lab(H,S(['tw_11_3']),{foes:3,big:true}); go(B); free(B); B.F[1].hp=B.F[1].maxHp*0.2; castWS(B,B.F[0]); rndAt(0.1125,()=>secs(0.55));
  near(B.F[1].stunned,0,'(a 0.1125 roll is above the 10% x 1.10 line: no freeze)',0.08); near(B.F[0].stunned,0,'(nor the others)');
});

test('Vaelora / Snowfall Hush (enemies inside her storm 3% a rank less attack and ability power) and Moor Feast (a kill inside it heals 2% a rank)',()=>{
  const L=lab(H,S(['wc_12_2','tw_12_3']),{foes:3,big:true}), {v,F}=L; go(L); const a0=F[0].dmg, p0=F[0].apow, a2=F[2].dmg; castWS(L,F[0]); V.step(2);
  near(F[0].dmg,a0*0.91,'inside: 3% x 3 less attack'); near(F[0].apow,p0*0.91,'and ability power'); near(F[2].dmg,a2,'(not outside)');
  v.maxHp=1e6; v.hp=5e5; F[1].hp=1; F[1].shield=0; V.hit(v,F[1],100,{kind:'true'}); near(v.hp,5e5+1e6*0.06,'Moor Feast: a kill inside it, 2% x 3 of her max HP',1e-6);
  secs(4.2); V.step(1); near(F[0].dmg,a0,'when the storm ends the debuff is gone');
});

/* ============================== WHITEOUT POUNCE ============================== */
test('Vaelora / the counter: Counter Fang, Deep Winter Pounce, Pounce Weight; Crouch (winds on an evade and on a stance with nothing to evade, spent by the counter: 3% a rank each), Deep Crouch, Coiled Legs, Wound Tight',()=>{
  const P0=lab(H,null,{foes:3,big:true}); castWP(P0); const c0=dmgOf(P0.F[1],()=>V.hit(P0.F[1],P0.v,1000,{kind:'phys'}));
  const L=lab(H,S(['pc_6_2','wc_6_2','tw_4_4']),{foes:3,big:true}); castWP(L); near(dmgOf(L.F[1],()=>V.hit(L.F[1],L.v,1000,{kind:'phys'})),c0*1.15*1.15*1.15,'5% x 3, 5% x 3, 3% x 5 more (each multiplies)');
  const C=lab(H,S(['tw_1_4','tw_2_4','tw_3_4','tw_9_4']),{foes:3,big:true,cold:true}), {v,F}=C; V.step(1); C.T=v._tal; assert.equal(stack(C,'vlCr'),5,'Wound Tight: each wave starts with 1 x 5');
  go(C); castWP(C); secs(2.3); assert.equal(stack(C,'vlCr'),6,'a stance that ends with nothing to evade: 1 more'); const p=plainHit(C,()=>hitOn(C,1000)); near(hitOn(C,1000),p*0.75,'Coiled Legs: 1% x 5 for each (6: 30%) - held at the 25% group cap');
  setStack(C,'vlCr',2); near(hitOn(C,1000),p*0.90,'(2: 10%)'); hold(C); castWP(C); const d=dmgOf(F[1],()=>V.hit(F[1],v,1000,{kind:'phys'})); near(d,c0*(1+0.15*3),'an evade winds 1 (3), the counter spends them all: 3% x 5 more each',1e-6);
  assert.equal(stack(C,'vlCr'),0,'spent'); setStack(C,'vlCr',8); V.step(1); assert.equal(stack(C,'vlCr'),8,'Deep Crouch: up to 5 + 1 x 3'); setStack(C,'vlCr',9); assert.ok(stack(C,'vlCr')<=9,'');
  V.wave(); V.step(1); assert.equal(stack(C,'vlCr'),5,'(each wave starts again at Wound Tight\'s 5)');
  go(C); setStack(C,'vlCr',7); castWP(C); secs(2.3); assert.equal(stack(C,'vlCr'),8,'Deep Crouch: a wind past the cap is held at 5 + 1 x 3');
});

test('Vaelora / the counter: Blood Warm, Throat Bite, On the Weakest, Snow Spring; the stance: Longer Whiteout, Evader, Whiteout Storm, Cat Reflex, Sharp Hearing; Second Pounce, Ready Pounce',()=>{
  const B=lab(H,S(['tw_4_3','tw_5_4','tw_6_4']),{foes:3,big:true}), {v,F}=B; v.maxHp=1e6; v.hp=5e5; free(B); castWP(B); const sp0=v.speed; const d=dmgOf(F[1],()=>V.hit(F[1],v,1000,{kind:'phys'}));
  near(v.hp,5e5+0.15*d,'Blood Warm: the counter heals 5% x 3 of its damage',1e-6); near(F[1].silencedT,1.5,'Throat Bite: its target silenced 1.5 s',1e-9); V.step(1); near(v.speed,sp0*1.15,'Snow Spring: after the counter 3% x 5 faster'); secs(3.1); near(v.speed,sp0,'for 3 s');
  const W=lab(H,S(['tw_5_3']),{foes:3,big:true}), w=W.F; w[2].hp=1e6; castWP(W); const c=dmgOf(w[1],()=>V.hit(w[1],W.v,1000,{kind:'phys'})); near(1e6-w[2].hp,0.5*c,'On the Weakest: then the lowest-HP enemy, at half the counter\'s damage',1e-6);
  const P0=lab(H,null,{foes:2,big:true}); castWP(P0); const dr0=P0.v.drMul;
  const E=lab(H,S(['tw_3_3','tw_7_3']),{foes:2,big:true}); castWP(E); near(E.v._evadeT,2.2+0.5,'Longer Whiteout: 0.1 x 5 s longer'); near(E.v.drT,2.7,'(its stance too)'); near(E.v.drMul,dr0-0.05,'Evader: 1% x 5 more of the damage taken off (5 points)');
  const S2=lab(H,S(['wc_7_2','tw_8_3']),{foes:3,big:true}); S2.v.maxHp=1e6; S2.v.hp=5e5; at(S2,S2.F[0],2.9+V.bodyR(S2.v)+V.bodyR(S2.F[0]),0); castWP(S2);
  const h0=S2.F[0].hp, h1=S2.F[1].hp, mm=VMX('defMul')(S2.v,S2.F[0],'magic'); secs(0.52); near(h0-S2.F[0].hp,0.2*S2.v.apow*mm,'Whiteout Storm: every 0.5 s an enemy within 3 m takes 0.2x her ability power',1e-6); assert.equal(S2.F[1].hp,h1,'(not one farther)');
  near(S2.v.hp,5e5+1e6*0.006,'Cat Reflex: 0.2% x 3 of her max HP every 0.5 s',1e-6); secs(2.0); near(S2.v.hp,5e5+1e6*0.006*4,'for its 2.2 s (4 in all)',1e-6); near(h0-S2.F[0].hp,0.2*S2.v.apow*mm*4,'',1e-6);
  const Sh=lab(H,S(['tw_12_4']),{foes:2,big:true}); Sh.v.slow=2; Sh.v.slowMul=0.5; rndAt(0.98,()=>castWP(Sh)); assert.ok(!(Sh.v.slow>0),'Sharp Hearing: cast while slowed, a 33% x 3 roll - the slow is cleared');
  const Sh2=lab(H,S(['tw_12_4']),{foes:2,big:true}); Sh2.v.slow=2; Sh2.v.slowMul=0.5; rndAt(0.995,()=>castWP(Sh2)); assert.ok(Sh2.v.slow>0,'(the roll failed)');
  const Q=lab(H,S(['tw_9_3','tw_4_1']),{foes:2,big:true}); near(FX.cd(Q.v,'blue',9),9-1.2,'Ready Pounce: 0.4 x 3 s shorter'); Q.v.blueCd=6; Q.v.hp=Q.v.maxHp*0.31; V.step(1); near(Q.v.blueCd,6,'');
  Q.v.hp=Q.v.maxHp*0.29; V.step(1); near(Q.v.blueCd,0,'Second Pounce: below 30% HP, ready at once'); Q.v.blueCd=6; Q.v.hp=Q.v.maxHp; V.step(1); Q.v.hp=Q.v.maxHp*0.2; V.step(1); near(Q.v.blueCd,6,'once per wave');
  V.wave(); V.step(1); Q.v.hp=Q.v.maxHp*0.2; V.step(1); near(Q.v.blueCd,0,'(again the next wave)');
  const SP=lab(H,S(['pc_7_2']),{foes:2,big:true}), sv=SP.v; go(SP); sv._untouched=3; V.step(2); castWP(SP); V.hit(SP.F[0],sv,1000,{kind:'phys'}); V.step(1);
  assert.ok(sv._saOn,'Silent Pounce: the hit her stance evaded does not spoil Silent Altitude'); assert.ok(!(vl(SP).spl>0),'(no Sulk)');
  const S0=lab(H,null,{foes:2,big:true}), s0=S0.v; go(S0); s0._untouched=3; V.step(2); castWP(S0); V.hit(S0.F[0],s0,1000,{kind:'phys'}); V.step(1);
  assert.ok(!s0._saOn,'(without the talent: an evaded hit spoils it)');
});

/* ============================== STARVING ============================== */
test('Vaelora / Starving: 1 every 2 s without a kill (Thin Belly faster), max 10, 0.4% a rank ability power each; a kill eats it: heals (Feast), Owl-Eater, Belly Full, Never Sorry; Ravenous; Gorged',()=>{
  const P0=lab(H,null,{foes:3,big:true}), ap0=P0.v.apow;
  const L=lab(H,S(['tw_1_2','tw_2_2','tw_10_2','tw_3_2','tw_6_2','tw_11_2','tw_5_2','tw_8_2']),{foes:3,big:true}), {v,F}=L; secs(1.0); assert.equal(stack(L,'vlStv'),0,''); secs(0.2); assert.equal(stack(L,'vlStv'),1,'1 after 2 - 0.3 x 3 = 1.1 s');
  setStack(L,'vlStv',6); V.step(1); near(v.apow,ap0*(1+0.02*6),'0.4% x 5 ability power each'); near(myHit(L,F[0],{auto:true}),1000*1.15,'Ravenous: at 6 her basic attacks 3% x 5 more'); setStack(L,'vlStv',5); near(myHit(L,F[0],{auto:true}),1000,'(5: no)');
  setStack(L,'vlStv',10); v.maxHp=1e6; v.hp=4e5; v.shield=0; v.greenCd=5; v.blueCd=6; v.energy=0; F[0].hp=1; F[0].shield=0; V.hit(v,F[0],100,{kind:'true'});
  near(v.hp,4e5+1e6*10*(0.015+0.005),'a kill eats 10: heals 0.3% x 5 + Feast 0.1% x 5 of her max HP for each',1e-6); assert.equal(stack(L,'vlStv'),0,'all eaten'); near(v.shield,1e5,'Owl-Eater: at 10, a 10% shield');
  near(v.greenCd,5-1.5,'Never Sorry: at 10, her cooldowns 0.5 x 3 s shorter'); near(v.blueCd,6-1.5,''); near(v.energy,9,'Gorged: 3 x 3 energy');
  const p=plainHit(L,()=>hitOn(L,1000)); near(hitOn(L,1000),p*0.91,'Belly Full: 3% x 3 less damage'); secs(4.1); near(hitOn(L,1000),p,'for 4 s');
  setStack(L,'vlStv',4); v.shield=0; v.greenCd=5; F[1].hp=1; F[1].shield=0; V.hit(v,F[1],100,{kind:'true'}); assert.ok(!(v.shield>0),'(4 eaten: no shield)'); near(v.greenCd,5,'(nor Never Sorry)');
});

test('Vaelora / Hoarded Cold (each critical hit 1 energy a rank, once a second) and the cooldown talents with their floors (Featherfang 3 s, Whiteout Pounce 5 s)',()=>{
  const L=lab(H,S(['pc_10_3']),{foes:2,big:true}), {v,F}=L; v.energy=0; V.hit(v,F[0],10,{kind:'true',crit:true}); near(v.energy,5,'a critical hit: 1 x 5'); V.hit(v,F[0],10,{kind:'true',crit:true}); near(v.energy,5,'(once a second)');
  V.hit(v,F[0],10,{kind:'true'}); secs(1.05); V.hit(v,F[0],10,{kind:'true',crit:true}); near(v.energy,10,'');
  const C=lab(H,S(['pc_2_3','wc_5_2','pc_9_3','wc_9_2','tw_10_4']),{foes:2,big:true}); near(FX.cd(C.v,'green',6),(6-0.9-1.0)*(1-0.13),'Quick Feather, Light Ring, then 13% (Cat Patience, Gathering Snow, Patient Hunter)'); near(FX.cd(C.v,'blue',9),9*0.87,'');
  const F2=lab(H,S(['pc_2_3','wc_5_2','pc_9_3','wc_9_2','tw_10_4']),{foes:2,big:true}); near(FX.cd(F2.v,'green',4.5),3,'never under 3 s');
  const G=lab(H,S(['pc_12_4','pc_1_4']),{foes:2,big:true}); FX.cd(G.v,'green',6); vl(G).gE=2; G.v.greenCd=1.5; saUp(G); V.hit(G.F[0],G.v,1,{kind:'true'}); near(G.v.greenCd,3-vl(G).gE,'Long Grudge: never under 3 s counted from the cast (the floor binds)',0.1);
});

/* ============================== CAPS ============================== */
test('Vaelora / damage reduction, one group of 25%: Sulk, Fence Post, Soft Paws, Nimble, Fluffed Up, Coiled Legs, Belly Full - each, multiplied, and all together; Wild Will (20% at most)',()=>{
  const L=lab(H,S(['pc_6_1','pc_1_1']),{foes:3,big:true}), {F}=L; setStack(L,'vlStalk',5); const far=F[2], near1=F[0];
  near(hitOn(L,1000,{src:far}),plainHit(L,()=>hitOn(L,1000,{src:far}))*0.88,'Fence Post: at 5 Stalk, an enemy 12 m away: 4% x 3 less'); near(hitOn(L,1000,{src:near1}),plainHit(L,()=>hitOn(L,1000,{src:near1})),'(one 2.9 m away: nothing)');
  setStack(L,'vlStalk',4); near(hitOn(L,1000,{src:far}),plainHit(L,()=>hitOn(L,1000,{src:far})),'(4 Stalk: nothing)');
  const A=lab(H,S(['pc_12_1','tw_10_1']),{foes:2,big:true}); near(hitOn(A,1000,{auto:true}),plainHit(A,()=>hitOn(A,1000,{auto:true}))*0.91*0.91,'Soft Paws, Nimble: basic attacks 3% x 3 less each (multiplied)'); near(hitOn(A,1000),plainHit(A,()=>hitOn(A,1000)),'(not skills)');
  const X=lab(H,S(['pc_1_4','pc_6_1','pc_1_1','pc_12_1','tw_10_1','wc_4_1','tw_3_4','tw_1_4','tw_6_2','wc_1_1']),{foes:3,big:true}); setStack(X,'vlStalk',5); setStack(X,'vlFea',20); setStack(X,'vlCr',5); vl(X).sulk=2; vl(X).bf=2;
  near(hitOn(X,1000,{src:X.F[2],auto:true}),plainHit(X,()=>hitOn(X,1000,{src:X.F[2],auto:true}))*0.75,'all of them at once (0.91 x 0.88 x 0.91 x 0.91 x 0.90 x 0.75 x 0.91): never more than 25% off a hit');
  near(X.T.fn.drK(api(X),X.T,X.v,X.F[2],'magic',true),0.75,'(the pure function the 95% check reads)');
  const C=lab(H,S(['tw_5_1']),{foes:2,big:true}), w=C.v; w.stunned=0; ccOn(C.F[0],w,'stunned',1); near(w.stunned,V.ccNerf*0.80,'Wild Will: controls on her 4% x 5 shorter (20%: its cap)',1e-9);
});

/* ============================== SIGNATURES ============================== */
test('Vaelora / The Owl Came Down (SIGNATURE): cast while Silent Altitude holds - nothing spoils it during the storm, every tick on an enemy it froze is a critical hit, and her next Featherfang is a critical hit on every enemy in its path',()=>{
  const L=lab(H,S(['pc_13_2','pc_12_2','pc_11_2','pc_1_4']),{foes:3,big:true}), {v,F}=L; go(L); free(L); v._untouched=3; V.step(2); assert.ok(v._saOn,''); castWS(L,F[0]);
  rndAt(0.05,()=>secs(0.55)); V.hit(F[2],v,1,{kind:'true'}); V.step(1); assert.ok(v._saOn,'a hit during the storm does not spoil Silent Altitude'); assert.ok(!(vl(L).sulk>0),'(no Sulk)');
  const t0=plainHit(L,()=>dmgOf(F[1],()=>{})); F[0].stunned=1; recL(L,F[0],{fz:1}); F[1].stunned=0; const h=F.map(f=>f.hp); rndAt(0.99,()=>secs(0.5));
  const d0=h[0]-F[0].hp, d1=h[1]-F[1].hp; assert.ok(d0>d1*1.5,'a tick on an enemy the storm froze is a critical hit ('+d0+' against '+d1+')');
  secs(3.5); assert.ok(!((v._blizzT||0)>0),'the storm is over'); hold(L); holdF(L); v._untouched=3; V.step(2);
  const g=F.map(f=>f.hp); castFF(L); const e=F.map((f,i)=>g[i]-f.hp); const P0=lab(H,null,{foes:3,big:true}); const pf=dmgOf(P0.F[1],()=>castFF(P0));
  for(let i=0;i<3;i++) assert.ok(e[i]>pf*1.5,'her next Featherfang: a critical hit on every enemy in its path (F'+i+': '+e[i]+')');
  const N=lab(H,S(['pc_13_2','pc_1_4']),{foes:3,big:true}); go(N); N.v._untouched=0; castWS(N,N.F[0]); secs(0.55); N.v._untouched=3; V.step(2); V.hit(N.F[2],N.v,1,{kind:'true'}); V.step(1); assert.ok(!N.v._saOn,'(cast while it did NOT hold: hits spoil it as before)');
});

test('Vaelora / The Moor\'s Long Winter (SIGNATURE): full Quills inside, each freeze 1 Quill to every enemy within 3 m, and at the end 1.5 s frozen with 3 Quills (the stun-lock rule)',()=>{
  const L=lab(H,S(['wc_13_3']),{foes:5,big:true}), {F}=L; go(L); free(L); V.step(3);   /* the march settles: put() holds from here */
  at(L,F[1],4.5,7.2); at(L,F[3],4.5,9.5); at(L,F[4],30,0); castWS(L,F[0]);
  rndAt(0.99,()=>secs(0.55)); assert.equal(qOn(L,F[0]),3,'every enemy inside: 3 Quills'); assert.equal(qOn(L,F[1]),3,''); assert.equal(qOn(L,F[3]),0,'(not one outside)');
  rndAt(0.05,()=>secs(0.5)); assert.equal(qOn(L,F[3]),1,'a freeze inside: 1 Quill to every enemy within 3 m of the frozen one (F3 got one though outside the storm)');
  F[0].stunned=0; recL(L,F[0],{st:0,lk:0,re:0}); F[1].stunned=0; recL(L,F[1],{st:0,lk:0,re:0});
  rndAt(0.99,()=>secs(2.8)); recL(L,F[1],{lk:0.3});   /* her stun on it ended 0.2 s before the storm */
  rndAt(0.99,()=>{ let guard=0; while((L.v._blizzT||0)>0&&guard++<400) V.step(0.05); });   /* the draw pinned: no random freeze may spoil the end */
  assert.equal(vl(L).st,null,'the storm is over');
  near(F[0].stunned,1.5,'at the end: every enemy with 3 Quills frozen 1.5 s',0.05); near(F[1].stunned,0,'(not within 0.5 s after her stun on it)',1e-9);
});

test('Vaelora / Dead of the Year (SIGNATURE): a claw each 1 s on the lowest-HP enemy inside (0.8x ability power, a critical hit at 10 Starving), each kill 1 s more storm (4 s at most), Starving eaten only at the end',()=>{
  const L=lab(H,S(['tw_13_3','tw_1_2']),{foes:4,big:true}), {v,F}=L; go(L); free(L); V.step(3);   /* the march settles: put() holds from here */
  F[1].hp=5e8; F[2].hp=5e8+1; at(L,F[1],4.5,5); at(L,F[2],4.5,-5);
  const mm=VMX('defMul')(v,F[1],'magic'); castWS(L,F[0]); setStack(L,'vlStv',3);
  const h1=F[1].hp, h2=F[2].hp; secs(0.95); const w1=h1-F[1].hp, w2=h2-F[2].hp; secs(0.1);
  const d1=h1-F[1].hp-w1, d2=h2-F[2].hp-w2; near(d1-d2,0.8*v.apow*mm,'the claw at 1 s: the lowest-HP enemy inside',1e-3);
  setStack(L,'vlStv',10); const h3=F[1].hp, h4=F[2].hp; secs(0.9); const u1=h3-F[1].hp, u2=h4-F[2].hp; secs(0.1);
  const e1=h3-F[1].hp-u1, e2=h4-F[2].hp-u2; near(e1-e2,1.6*0.8*v.apow*mm,'at 10 Starving it is a critical hit',1e-3);
  const b0=v._blizzT; F[2].hp=1; F[2].shield=0; at(L,F[2],6,1); V.hit(v,F[2],10,{kind:'true'}); near(v._blizzT,b0+1,'a kill during the storm: 1 s more'); assert.equal(stack(L,'vlStv'),10,'and Starving is not eaten');
  for(let i=0;i<6;i++){ const x=L.F[3]; x.alive=true; x.hp=1; x.shield=0; V.hit(v,x,10,{kind:'true'}); } assert.equal(vl(L).st.ext,4,'4 s more at most');
  let guard=0; while((v._blizzT||0)>0&&guard++<2000) V.step(0.05); assert.equal(stack(L,'vlStv'),0,'the storm over: her Starving eaten at last');
});

/* ============================== HER STUN LIMITS ============================== */
test('Vaelora / her stuns: never more than 4.0 s in a row on one enemy, then 0.5 s free; talent stuns never on a stunned enemy or within 0.5 s after hers ended',()=>{
  const L=lab(H,S(['wc_9_3','wc_9_4','wc_1_4']),{foes:3,big:true}), {F}=L; go(L); free(L); castWS(L,F[0]); rndAt(0.05,()=>secs(0.55)); near(F[0].stunned,1.34,'',0.08);
  const r=rq(L,F[0]); r.re=3.4; r.st=0.6; F[0].stunned=0.6; rndAt(0.05,()=>secs(0.5)); near(F[0].stunned,0.1,'a freeze when she has held it 3.9 s in a row: cut to end at 4.0 s',0.05);
  secs(0.15); rndAt(0.05,()=>secs(0.4)); near(F[0].stunned,0,'and one inside the next 0.5 s is taken back',1e-9);
  const T2=lab(H,S(['wc_9_4','wc_1_4']),{foes:3,big:true}); free(T2); const g=T2.F[1]; T2.T.fn.tstun(api(T2),T2.T,T2.v,g,0.3,'test'); near(g.stunned,0.3,'',1e-9); secs(0.45); assert.ok(!(g.stunned>0),'');
  T2.T.fn.tstun(api(T2),T2.T,T2.v,g,0.8,'test'); assert.ok(!(g.stunned>0),'0.15 s after her stun on it ended: refused'); secs(0.45); T2.T.fn.tstun(api(T2),T2.T,T2.v,g,0.8,'test'); near(g.stunned,0.8,'0.6 s after: it lands',1e-9);
  g.stunned=0.5; T2.T.fn.tstun(api(T2),T2.T,T2.v,g,0.8,'test'); near(g.stunned,0.5,'(already stunned: refused)',1e-9); assert.ok(vl(T2).ts.onStun>=1&&vl(T2).ts.lkOk>=1,'every refusal counted');
});

/* ============================== WAVES ============================== */
test('Vaelora / the wave clock: Kept Height\'s 10 s and the storm are countdowns (a wave whose clock restarts at 0); her records of the last wave\'s enemies are dropped',()=>{
  const L=lab(H,S(['pc_3_1','pc_1_4','wc_1_4']),{foes:3,big:true}), {v,F}=L; saUp(L); V.hit(F[0],v,1,{kind:'true'}); near(vl(L).kh,10,'(Kept Height used)'); recL(L,F[1],{q:2,qt:5}); secs(4);
  V.wave(); VMX('battleTime=0'); V.step(1); assert.ok(!rq(L,F[1]),'a new wave: her records are dropped'); near(vl(L).kh,6,'Kept Height: 6 s left, counted down across the wave',0.1);
  saUp(L); secs(6.3); V.hit(F[0],v,1,{kind:'true'}); V.step(1); assert.ok(v._saOn,'kept again 10 s after the first (an absolute time would wait for the new wave\'s clock)');
});

/* ============================== WHOLE FIGHTS ============================== */
test('Vaelora: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=everything(H), TEAM=['vael','sylthaine','vireo','vex','vaelora'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  const mx={vlStalk:0,vlFea:0,vlStv:0,vlCr:0,q:0,storm:0,sulk:0};
  for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ V.step(1); const T0=s._tal.s, W=T0.vl; for(const k of ['vlStalk','vlFea','vlStv','vlCr']) mx[k]=Math.max(mx[k],(T0.k[k]||{n:0}).n);
    if(W){ for(const k in W.e){ const r=W.e[k]; if(r.qt>0) mx.q=Math.max(mx.q,r.q); } if(W.st) mx.storm=1; if(W.sulk>0) mx.sulk=1; } }
  assert.ok(mx.vlStalk>=1,'real Stalk'); assert.ok(mx.vlFea>=1,'real feathers'); assert.ok(mx.vlStv>=1,'real Starving'); assert.ok(mx.q>=1,'real Quills'); assert.ok(mx.storm,'a real storm');
  console.log('  live fight: max '+JSON.stringify(mx)); determinism(H,TEAM);
});

/* The page line her talents changed (the guarded freeze-chance num in Blizzard's tick now names the enemy rolled for): with nothing learned, whole seeded fights
   with Vaelora in the line-up are identical to the pre-talent page (ee8edab8), seed by seed, and reach that line. */
const BASE_SHA=process.env.TALENT_BASE||'ee8edab85c45b52cf17c71c5e4890e03deb753bc';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-'));
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); const h=SH.load(path.join(dir,'emberweave-heroes.html')); return {h,dir}; }
test('Vaelora: no talents - whole fights with her in the line-up are identical to the pre-talent page, and they reach the page line her talents changed',()=>{
  let B=null; try{ B=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+')'); }
  assert.ok(B,'the pre-talent page could be loaded'); const BASE=B.h;
  try{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['vaelora','vael','vireo','sylthaine','gruel'], foeTeam=['ambrel','carn','dandra','konwu','ceraline'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>spec(k,70))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __vbN={ff:0,wp:0,ws:0,ctr:0,tick:0}; var __vbD=_doEffectCore, __vbT=think;'+
    '_doEffectCore=function(u,type,o){ if(u&&u.key==="vaelora"){ if(type==="piercethrow") __vbN.ff++; if(type==="evadecounter") __vbN.wp++; if(type==="blizzard") __vbN.ws++; } return __vbD.apply(this,arguments); };'+
    'think=function(u,dt){ if(u&&u.key==="vaelora"&&(u._blizzT||0)>0&&(u._blizzAcc||0)+dt>=0.5) __vbN.tick++; return __vbT.apply(this,arguments); };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>spec(k,68)))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'her on the other side, seed '+seed); n+=2; }
    const c=VMX('__vbN'); console.log('  identity: '+JSON.stringify(c));
    assert.ok(c.ff>0&&c.wp>0&&c.ws>0&&c.tick>0,'the fights cast Featherfang ('+c.ff+'), Whiteout Pounce ('+c.wp+') and Winter Plumage ('+c.ws+'), whose ticks pass the changed line ('+c.tick+')'); }
  finally{ VMX('_doEffectCore=__vbD; think=__vbT;'); }
  assert.ok(n>=18); } finally{ try{ fs.rmSync(B.dir,{recursive:true,force:true}); }catch(e){} }
});

/* her stun limits in seeded fights: the most freeze-heavy legal builds (91 deep in Winter Comes Down; 61 Winter + 30 Hungry; 61 Hungry + 30 Winter), every freeze
   talent of both. No talent stun on an enemy already stunned or within 0.5 s after hers ended; the longest time one enemy stays stunned by her in a row. */
function deep(order,caps,want){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={pc:0,wc:1,tw:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of want[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
const STUNW={ pc:['pc_13_2','pc_12_2'], wc:['wc_13_3','wc_9_3','wc_9_4','wc_1_4','wc_10_3','wc_8_4'], tw:['tw_13_3','tw_11_3','tw_12_3'] };
const RUNMAX=4.0+0.05;
test('Vaelora: her stun limits hold in seeded fights, and her longest stun chain on one enemy',()=>{
  const builds=[[['wc'],[91]],[['wc','tw'],[61,30]],[['tw','wc'],[61,30]]].map(([o,c])=>{ const b=deep(o,c,STUNW); assert.equal(T.invalid(H,b,100),'','a legal build'); return {o,list:T.learned(H,b),b}; });
  VMX('var __vs={ticks:0,run:0,runs:[]}; var __vsU=_updateBattleCore;'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(!(u&&u.key==="vaelora"&&u._tal&&u._tal.s.vl)) continue; const Q=u._tal.s.vl; __vs.ticks++;'+
    '    if(!u.alive) continue; for(const k in Q.e){ const r=Q.e[k]; if(!r.u.alive) continue; if(r.st>0&&(r.u.stunned||0)>0){ r.__run=(r.__run||0)+dt; if(r.__run>__vs.run) __vs.run=r.__run; } else if(r.__run){ __vs.runs.push(+r.__run.toFixed(2)); r.__run=0; } } }'+
    '  return __vsU.apply(this,arguments); };');
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')); const out=[];
  try{ for(const B of builds){ VMX('__vs.ticks=0; __vs.run=0; __vs.runs=[]');
      const sn=snaps(['vaelora','vael','vireo','sylthaine','gruel'].map(k=>Object.assign(spec(k,100,k===H?B.list:null),{skillLv:[100,100,100,100]})));
      for(const node of [34,60,90,120]) for(const seed of [11,90210]){ NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]); }
      const foe=snaps(['absalie','astra','vireo','sylthaine','vex'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
      for(const seed of [3,5]){ NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); }
      const c=JSON.parse(JSON.stringify(VMX('__vs'))); const med=c.runs.length?c.runs.slice().sort((a,b)=>a-b)[Math.floor(c.runs.length/2)]:0;
      out.push(B.o.join('+')+' '+JSON.stringify(T.spent(H,B.b).tree)+': longest run on one enemy '+c.run.toFixed(2)+' s, median '+med+' s, runs '+c.runs.length);
      console.log('  '+out[out.length-1]); assert.ok(c.ticks>300,'she fought'); assert.ok(c.run<=RUNMAX,'no enemy is stunned by her more than 4.0 s in a row (seen '+c.run.toFixed(2)+' s)'); } }
  finally{ VMX('_updateBattleCore=__vsU;'); }
  console.log('  stun chains: '+out.join(' | '));
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and nobody near it for more than half a battle. Vaelora's talent reductions are one capped group (25%);
   her base kit adds Whiteout Pounce's stance (45% + 0.1 pt a level: 54.9% at level 100; Evader +5 points). Each candidate build is 91 points legal; the most
   defensive is the one whose worst hit is reduced most. */
const DEF={ pc:['pc_1_4','pc_6_1','pc_12_1','pc_1_1','pc_10_4'], wc:['wc_4_1','wc_1_1','wc_11_2','wc_3_1','wc_7_4','wc_2_1'], tw:['tw_3_4','tw_1_4','tw_2_4','tw_6_2','tw_1_2','tw_10_1','tw_7_3','tw_3_3','tw_12_1','tw_2_1','tw_9_4'] };
function lab100(list){ const U=V.arena(snaps([Object.assign(spec(H,100,list),{skillLv:[100,100,100,100]})].concat([0,1,2,3].map(()=>spec('vael',100,null,0)))),snaps([0,1,2,3].map(()=>spec('vael',100,null,0))),7), v=U[0], F=U.filter(u=>u.team==='enemy'), A=U.filter(u=>u.team==='ally'&&u!==v);
  for(const u of U){ u.stunned=1e6; u.evaStat=0; u.blockStat=0; u.glyphCrit=0; u.glyphRegen=0; u.energyReg=0; u.energy=0; u.ctrlRes=0; u.glyphDR=0; if(u!==v){ u.maxHp=u.hp=1e9; } }
  v.x=300; v.y=700; F.forEach((f,i)=>{ f.x=v.x+[12,10,15.5,4.5][i]*V.METER; f.y=v.y+[0,0,0,6][i]*V.METER; }); A.forEach((a,i)=>{ a.x=v.x+[0,0,0,-5][i]*V.METER; a.y=v.y-[5.5,11,16.5,5][i]*V.METER; }); V.step(1); return {v,F,A,T:v._tal}; }
/* the worst hit on her: every condition of her damage-reduction talents true at once - Sulk on, 5 Stalk and an attacker more than 6 m away, a basic attack, 20 feathers,
   a full Crouch, Belly Full - inside Whiteout Pounce's stance (Evader); physical and magic, normal and critical, with her armour and magic resist; and again with glyph
   damage reduction at its 30% cap. */
function worstHit(list,kind,crit,glyph){ const L=lab100(list), {v,F}=L, f=F[0];
  v.maxHp=1e6; v.hp=0.6*v.maxHp; v.shield=0; v.glyphDR=glyph||0;
  V.cast(v,'blue'); v._evadeT=0;
  if(L.T){ const W=L.T.s.vl; W.sulk=9; W.bf=9; for(const [k,n] of [['vlStalk',5],['vlFea',20],['vlCr',8]]) L.T.s.k[k]=Object.assign(L.T.s.k[k]||{},{n,t:99,idle:0}); }
  const raw=1e5, h0=v.hp; V.hit(f,v,raw,{kind,crit,auto:true}); const x=h0-v.hp, cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1; return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Vaelora: her most defensive legal 91-point build never takes 95% off a hit, its worst hit stays under 90%, and she is at 85% or more for well under half a fight',()=>{
  const cands=[[['pc','wc'],[61,30]],[['pc','tw'],[61,30]],[['wc','pc'],[61,30]],[['wc','tw'],[61,30]],[['tw','pc'],[61,30]],[['tw','wc'],[61,30]],[['pc'],[91]],[['wc'],[91]],[['tw'],[91]],[['tw','wc','pc'],null]].map(([o,c])=>{ const b=deep(o,c,DEF); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; c.worstG=0; for(const kind of ['magic','phys']) for(const crit of [false,true]){ c.worst=Math.max(c.worst,worstHit(c.list,kind,crit,0)); c.worstG=Math.max(c.worstG,worstHit(c.list,kind,crit,0.30)); } }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,0))), noneG=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,0.30)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' '+(c.worst*100).toFixed(1)+'% ('+(c.worstG*100).toFixed(1)+'% with 30% glyphs)').join(' | '));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.90,'the worst possible hit on her most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 90%');
  assert.ok(Math.max(...cands.map(c=>c.worstG))<0.95,'with 30% glyph reduction too: below 95% ('+(Math.max(...cands.map(c=>c.worstG))*100).toFixed(1)+'%)');
  VMX('var __dr={max:0,n:0,at:0,hi:0,imm:0,ticks:0,t:0,tp:0,tm:0,tp85:0,tm85:0,te85:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="vaelora"&&src&&src.team!==tgt.team&&!((tgt._evadeT||0)>0); let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); tgt._critHit=false; } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive&&!tgt._critHit){ const raw=amt*elemMul(src,tgt), l=h0-tgt.hp-(tgt.shield||0); if(raw>0&&l>1e-6*raw){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(!(u&&u.key==="vaelora"&&u.alive)) continue; __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++;'+
    '    let s=null; for(const e of units) if(e.alive&&e.team!==u.team&&e.target===u){ s=e; break; } if(!s) s=nearestEnemy(u); if(!s) continue; const T=u._tal;'+
    '    const k=(u.drT>0?u.drMul:1)*(u.glyphDR?1-u.glyphDR:1);'+
    '    const kp=k*defMul(s,u,"phys")*(T&&T.s.api?T.fn.drK(T.s.api,T,u,s,"phys",true):1), km=k*defMul(s,u,"magic")*(T&&T.s.api?T.fn.drK(T.s.api,T,u,s,"magic",true):1);'+
    '    __dr.t++; __dr.tp+=1-kp; __dr.tm+=1-km; if(1-kp>=0.85) __dr.tp85++; if(1-km>=0.85) __dr.tm85++; if(1-kp>=0.85||1-km>=0.85) __dr.te85++; } return __ubc.apply(this,arguments); };');
  const seeded=(list,glyph)=>{ VMX('for(const k in __dr) __dr[k]=0'); const sp=k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]});
    const sn=snaps(['vael','sylthaine','vireo','vex','vaelora'].map(sp)); if(glyph) for(const x of sn) if(x.key===H) x.glyphDR=glyph;
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','carn'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); return JSON.parse(JSON.stringify(VMX('__dr'))); };
  try{ const d0=seeded(null), d=seeded(best.list), pc=(a,b)=>(100*a/Math.max(1,b)).toFixed(1)+'%';
    const line=(x,tag)=>tag+': '+x.n+' hits, the most reduced '+(x.max*100).toFixed(1)+'%, 85% or more '+x.hi+', at the ceiling '+x.at+', immune ticks '+x.imm+' of '+x.ticks+'; reference hit sustained physical '+(100*x.tp/Math.max(1,x.t)).toFixed(1)+'% / magic '+(100*x.tm/Math.max(1,x.t)).toFixed(1)+'%, share of the fight at 85% or more physical '+pc(x.tp85,x.t)+' / magic '+pc(x.tm85,x.t)+' / either '+pc(x.te85,x.t);
    console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%); with 30% glyphs '+(best.worstG*100).toFixed(1)+'% (no talents '+(noneG*100).toFixed(1)+'%)');
    console.log('  '+line(d0,'no talents')); console.log('  '+line(d,'that build'));
    assert.ok(d.n>20&&d.ticks>500,'hits on her: '+d.n);
    assert.ok(d.max<0.95,'no hit on her was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0,'so she never sits at the ceiling'); assert.equal(d.imm,0,'and she is never immune');
    assert.ok(d.te85<0.25*d.t,'at 85% or more for well under half of her time in the fights ('+pc(d.te85,d.t)+')'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});
