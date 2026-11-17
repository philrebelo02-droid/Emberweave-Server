'use strict';
/* Bloatus's talents as data on the mechanics layer (talents-mech/bloatus.js), group by group on the still field (tests/talents-lab.js), then whole fights,
   the no-talent identity of the page sites his talents added, and Phil's 95% damage-reduction ceiling.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with his talents switched
   off for one hit / one tick (plainHit, tickRatio) or in a plain lab built BEFORE the talented one: lab() replaces the whole field.
   Places (metres from Bloatus, centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0) F3 (0,6) F4 (5.5,6) F5 (11,6); A0 (0,-5.5). Bodies 2.01 m: F0 0.48 m from him body to body.
   Lab units are HELD (stunned 1e6): to the talents they are rooted. free() lets one go (and makes his controls land on it: level 1).
   Run: node --test tests/talents-mech-bloatus.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,mark,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='bloatus', S=ids=>full(H,ids);
test.afterEach(()=>{ FX.define(H,null); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const VMX=s=>vm.runInContext(s,NOW.ctx);
const plain=(o,fn)=>fn(lab(H,null,o));
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{},{n,t:99,idle:0}); };
const ust=(L,t,name)=>{ const o=t._talM&&t._talM[L.v.uid], m=o&&o['#'+name]; return (m&&V.now()<m.until)?m.v:0; };
const setUst=(L,t,name,n)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o['#'+name]={v:n,until:V.now()+99}; };
const setMk=(L,t,name,dur)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o[name]={t0:V.now(),until:V.now()+(dur||99),v:0}; };
const win=(L,name)=>{ const w=L.T.s.w[name]; return !!w&&w.t>0; };
const free=x=>{ x.stunned=0; x.silencedT=0; x.speed=0; x.level=1; };
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const noDef=L=>{ for(const f of L.F){ f.mrRating=0; f.armorRating=0; } };
const hitOn=(L,t,amt,o)=>lost(t,()=>V.hit(o&&o.src||L.F[0],t,amt||1000,Object.assign({kind:'true'},o||{})));   // an enemy's hit on t (true damage: no armor in the way)
const land=()=>secs(0.55);                                                          // his queued poisons land (the game queues each one 0.5 s)
/* a poison of his on t through the game's own queue (plagueDot), with the game's Contagion flags as his skills set them */
const poison=(L,t,dps,dur)=>{ VMX('plagueDot')(t,dps||100,dur||4,1,'#8fbf3f',L.v,'magic'); t._contagion=true; t._plagueDps=dps||100; t._plagueColor='#8fbf3f'; t._plagueHex=0x8fbf3f; };
const mine=(L,t,tag)=>(t.dots||[]).filter(d=>d._talO===L.v.uid&&(tag==null||d._talK===tag));
/* one tick of DoT d on t (no other DoT of t ticks in that step) */
function tickLoss(L,t,d){ for(const u of VMX('units')) for(const x of (u.dots||[])) if(x!==d) x.acc=0; const r=Math.max(2,d.remaining); d.remaining=r; d.acc=d.interval; const l=lost(t,()=>V.step(1)); d.remaining=r; return l; }
/* the same tick with his talents and without them */
function tickRatio(L,t,d){ const a=tickLoss(L,t,d), T0=L.v._tal; L.v._tal=undefined; try{ return a/tickLoss(L,t,d); } finally{ L.v._tal=T0; } }
/* a hit of his during one of his skills (casting rows) against the same hit with his talents off */
function skillRatio(L,t,skill,kind){ L.T.s.cur=skill; let a; try{ a=lost(t,()=>V.hit(L.v,t,1000,{kind:kind||'true'})); } finally{ L.T.s.cur=null; } return a/plainHit(L,()=>lost(t,()=>V.hit(L.v,t,1000,{kind:kind||'true'}))); }
const kill=(L,t)=>{ t.hp=1; t.shield=0; V.dmg(t,100); assert.ok(!t.alive,'it died'); };
const bp=L=>L.v.apow*VMX('skillMul')(10)*0.5;                                        // Toxic Breath's own poison a second at the lab's skill level 10
const clk=(L,key)=>{ const l=L.T.s.lim[key]; if(l) l.acc=0; };                        // a once-a-second row's clock starts again now
const ccOn=(src,t,field,secs)=>{ const lv=t.level; t.level=1; try{ V.cc(src,t,field,secs); } finally{ t.level=lv; } };   // a control that lands (no resist)

test('Bloatus: every talent is accounted for - 9 plain stats, 114 with rows, none waiting',()=>{
  accounting(H,[123,9,114,0,0]);
  const M=FXN.mech(H); for(const id of ['pk_1_1','dc_1_1','km_1_1','pk_13_2','dc_13_3','km_13_2']) assert.ok(M.talents[id],id);
  for(const id of ['pk_10_3','pk_12_3','pk_3_3','dc_1_2','dc_3_2','dc_n2','km_1_3','km_3_3','km_n1']) assert.ok(FXN.has(H,id),id+' is a plain stat');
});

test('Bloatus: his real kit, as the talents read it - the breath to the farthest enemy, his poisons queued 0.5 s, Swampcall on the two farthest, Plague Sovereign around him, Contagion',()=>{
  plain({foes:3},P=>{ const {v,F}=P; for(const f of F) free(f); const pd=bp(P);
    const h0=F.map(f=>f.hp); V.cast(v,'green'); assert.ok(F[0].hp<h0[0]&&F[1].hp<h0[1],'the plume reaches the farthest enemy within 15 m (F1) and hits on the way'); near(F[2].hp,h0[2],'not F2 (15.5 m)');
    assert.equal(F[0].dots.length,0,'its poison is queued'); land(); assert.equal(F[0].dots.length,1,'and lands 0.5 s later'); near(F[0].dots[0].dps,pd,'50% of his ability power a second at the skill level'); assert.equal(F[0].dots[0].src,v);
    V.cast(v,'blue'); near(F[2].stunned,V.cap('stunned'),'Swampcall roots the two farthest (its root sits at the 2.8 s ceiling)',1e-9); near(F[1].stunned,V.cap('stunned'),'',1e-9); near(F[1].silencedT,2.0,'and silences them 2 s',1e-9); near(F[0].stunned,0,'not the nearest');
    for(const f of F) free(f); const g0=F.map(f=>f.hp); V.cast(v,'ult'); assert.ok(F[0].hp<g0[0],'Plague Sovereign: within 5 m of him'); near(F[1].hp,g0[1],'not 10 m away');
    at(P,F[1],4.5,2.2); F[1].dots.length=0; kill(P,F[0]); land(); assert.equal(F[1].dots.filter(d=>d.color==='#8fbf3f').length,1,'Contagion: the poison of an enemy that dies spreads to an enemy 2.2 m away'); assert.equal(F[2].dots.length,0,'not to one far away'); });
  const L=lab(H,S(['pk_1_2']),{foes:3}), {v,F}=L; for(const f of F) free(f);
  V.cast(v,'green'); land(); assert.equal(mine(L,F[0],'toxbreath').length,1,'his breath\'s poison is his, from Toxic Breath'); V.cast(v,'ult'); land(); assert.equal(mine(L,F[0],'plaguesov').length,1,'the ultimate\'s');
  poison(L,F[2]); land(); assert.equal(mine(L,F[2],'other').length,1,'any other queued poison of his');
  at(L,F[1],4.5,2.2); kill(L,F[0]); land(); assert.equal(mine(L,F[1],'spread').length,1,'and a Contagion spread is a spread');
});

/* ============================== THE PLAGUE KING ============================== */
test('Bloatus / Rot: Rot, Deep Rot, Black Rot',()=>{
  const L=lab(H,S(['pk_1_2','pk_2_2','pk_4_2']),{foes:3}), {v,F}=L; free(F[0]);
  poison(L,F[0]); land(); assert.equal(ust(L,F[0],'rot'),0,'the first poison: no Rot'); poison(L,F[0]); land(); assert.equal(ust(L,F[0],'rot'),1,'poisoned again while it carries his poison: 1 Rot');
  for(let i=0;i<6;i++){ poison(L,F[0]); land(); } assert.equal(ust(L,F[0],'rot'),5,'max 5');
  secs(8.6); assert.equal(ust(L,F[0],'rot'),5,'Deep Rot: they last 6 + 3 s'); secs(0.5); assert.equal(ust(L,F[0],'rot'),0,'then lapse');
  const d=mine(L,F[1])[0]||(poison(L,F[1]),land(),mine(L,F[1])[0]); setUst(L,F[1],'rot',4); near(tickRatio(L,F[1],d),1+0.006*5*4,'Rot: each Rot makes his poison tick 0.6% x 5 harder');
  F[2].hp=F[2].maxHp*0.5; const b=lost(F[2],()=>V.heal(F[2],1000)); setUst(L,F[2],'rot',5); near(-lost(F[2],()=>V.heal(F[2],1000)),-b*(1-0.15),'Black Rot: at 5 Rot it receives 5% x 3 less healing');
  setUst(L,F[2],'rot',4); near(lost(F[2],()=>V.heal(F[2],1000)),b,'not at 4');
});

test('Bloatus / Rot to the Core (PICK ONE) and Weeping Sores: at 5 Rot armor and magic resist 15% lower; each Rot 0.3% x 5 attack speed',()=>{
  const L=lab(H,S(['pk_5_2','pk_8_2']),{foes:3}), {F}=L; const a0=F[0].armorRating, m0=F[0].mrRating, i0=F[0].atkInterval;
  setUst(L,F[0],'rot',4); V.step(2); near(F[0].armorRating,a0,'not at 4 Rot'); near(F[0].atkInterval,i0/(1-0.015*4),'Weeping Sores: 4 Rot');
  setUst(L,F[0],'rot',5); V.step(2); near(F[0].armorRating,a0*0.85,'Rot to the Core'); near(F[0].mrRating,m0*0.85,''); near(F[0].atkInterval,i0/(1-0.015*5),'');
  setUst(L,F[0],'rot',0); V.step(2); near(F[0].armorRating,a0,'given back'); near(F[0].atkInterval,i0,'');
});

test('Bloatus / the Carrier: Patient Zero, Fever, Infection, Sick at Court, Plague Bearer',()=>{
  const L=lab(H,S(['pk_1_1','pk_2_1','pk_10_1','pk_n2','pk_3_1','pk_1_2']),{foes:3,allies:1,big:true}), {v,F,A}=L; free(F[0]); free(F[1]); F[1].speed=100; const s0=F[1].speed;
  poison(L,F[0],100); poison(L,F[1],300); land(); V.step(1); assert.ok(mark(L,F[1],'car'),'the Carrier: the enemy carrying the most of his poison'); assert.ok(!mark(L,F[0],'car'));
  near(tickRatio(L,F[1],mine(L,F[1])[0]),1.15*1.10,'Patient Zero 5% x 3 and Infection 2% x 5 on his poison on the Carrier'); near(tickRatio(L,F[0],mine(L,F[0])[0]),1,'not on another enemy');
  V.step(2); near(F[1].speed,s0*(1-0.12),'Fever: the Carrier moves 4% x 3 slower');
  near(lost(F[1],()=>V.hit(A[0],F[1],1000,{kind:'true'})),plainHit(L,()=>lost(F[1],()=>V.hit(A[0],F[1],1000,{kind:'true'})))*1.10,'Infection: the Carrier takes 2% x 5 more from his whole team');
  near(hitOn(L,v,1000,{src:F[1]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[1]}))*0.97,'Sick at Court: the Carrier deals 3% less to him'); near(hitOn(L,v,1000,{src:F[0]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[0]})),'not another enemy');
  kill(L,F[1]); assert.ok(mark(L,F[0],'car'),'Plague Bearer: the next most poisoned is the Carrier at once'); assert.equal(ust(L,F[0],'rot'),2,'with 2 Rot');
  V.step(3); assert.ok(mark(L,F[0],'car'),'and stays it');
});

test('Bloatus / Contagion and Outbreak: Epidemic, Patient Zero\'s reach, Outbreak, Carried on the Wind, Endemic, Sick Room, Pandemic, Plague Wind, Spreading Season, Old Pestilence',()=>{
  const L=lab(H,S(['pk_3_4','pk_1_1','pk_1_4','pk_6_3','pk_11_2','pk_5_4','pk_12_2','pk_7_4','pk_12_4','pk_6_4']),{foes:5,big:true}), {v,F}=L; for(const f of F) free(f);
  assert.equal(stack(L,'ob'),4,'Old Pestilence: the wave starts with 2 x 2 Outbreak'); near(L.T.st.ob.max,14,'Spreading Season: up to 14');
  poison(L,F[0],200); land(); V.step(1); assert.ok(mark(L,F[0],'car'),'(F0 is the Carrier)');
  at(L,F[3],4.5,8.3); at(L,F[4],4.5,-8.7); at(L,F[1],30,0); const ap0=v.apow; v.hp=v.maxHp*0.5; const h0=v.hp;
  kill(L,F[0]); assert.equal(stack(L,'ob'),5,'one enemy caught it: 1 Outbreak'); near(v.hp-h0,v.maxHp*0.025,'Endemic: each spread heals 0.5% x 5',1e-6);
  land(); const sp=mine(L,F[3],'spread'), rem0=sp[0]&&sp[0].remaining; assert.equal(sp.length,1,'Epidemic 0.2 x 5 + Patient Zero 0.3 x 3 (the Carrier died): 4.5 m body to body reaches F3 4.28 m away'); assert.equal(F[4].dots.length,0,'not F4 4.68 m away');
  near(sp[0].dps,200*1.12,'Carried on the Wind: spread poison 4% x 3 stronger'); V.step(1); near(v.apow,ap0/(1+0.015*4)*(1+0.015*5),'Outbreak: 0.3% x 5 ability power each');
  setStack(L,'ob',10); near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*(1-0.06),'Sick Room: 0.2% x 3 less per Outbreak');
  poison(L,F[2],100); land(); near(tickRatio(L,F[2],mine(L,F[2])[0]),1+0.01*10,'Pandemic: 0.2% x 5 harder ticks per Outbreak (F2 is not the Carrier)');
  setStack(L,'ob',10); F[1].dots.length=0; at(L,F[1],4.5,8.3+3.0);
  kill(L,F[3]); land(); const sp2=mine(L,F[1],'spread'); assert.equal(sp2.length,1,'(the next spread)'); assert.equal(sp2[0].remaining,rem0+2,'Plague Wind: at 10 Outbreak the spread lasts 0.4 x 5 s longer');
});

test('Bloatus / Clean Spread (PICK ONE) and Spore Burst: Rot carried by the spread; 5 Rot: twice as far, the new victims with 3 Rot',()=>{
  { const L=lab(H,S(['pk_5_3','pk_1_2']),{foes:3}), {F}=L; for(const f of F) free(f); poison(L,F[0]); land(); setUst(L,F[0],'rot',4); at(L,F[1],4.5,2.2);
    kill(L,F[0]); assert.equal(ust(L,F[1],'rot'),4,'Clean Spread: the dead enemy\'s 4 Rot go with it'); }
  const L=lab(H,S(['pk_9_2','pk_1_2']),{foes:3}), {F}=L; for(const f of F) free(f); poison(L,F[0]); land(); setUst(L,F[0],'rot',5); at(L,F[1],4.5,8.9); at(L,F[2],4.5,-9.5);
  kill(L,F[0]); assert.equal(ust(L,F[1],'rot'),3,'Spore Burst: the new victim starts with 3 Rot'); land(); assert.equal(mine(L,F[1],'spread').length,1,'twice as far: 5.2 m body to body (F1 4.88 m)'); assert.equal(F[2].dots.length,0,'not 5.48 m');
  poison(L,F[1]); land(); setUst(L,F[1],'rot',4); at(L,F[2],F[1].x/V.METER-L.v.x/V.METER,F[1].y/V.METER-L.v.y/V.METER+7); kill(L,F[1]); land(); assert.equal(F[2].dots.length,0,'at 4 Rot: the usual 2.6 m (2.98 m away)');
});

test('Bloatus / his poison: Crown of Flies, Wasting, Bedridden, Long Sickness, Lingering Cough, Swamp Lungs, Rotting Ground, Sickly Sweet, Marsh Gas, Sick Kingdom, Bitter Air',()=>{
  const L=lab(H,S(['pk_7_3','pk_8_1','pk_n1','pk_4_1','pk_12_1','pk_2_3','pk_11_4','pk_10_2','pk_6_1','pk_9_4','pk_9_3']),{foes:3,allies:1}), {v,F,A}=L; for(const f of F) free(f);
  poison(L,F[2]); land(); const d=mine(L,F[2])[0]; assert.equal(d.remaining,6,'Long Sickness: 4 s + 0.3 x 5 = 5.5 s (6 ticks, the last a half)'); near(d._talF,0.5,'');
  near(tickRatio(L,F[2],d),1.10,'Crown of Flies 2% x 5'); F[2].hp=F[2].maxHp*0.39; near(tickRatio(L,F[2],d),1.10*1.15,'Wasting: below 40% HP 3% x 5 more');
  F[2].hp=F[2].maxHp; F[2].silencedT=3; near(tickRatio(L,F[2],d),1.10*1.20,'Bedridden: silenced, 4% x 5'); F[2].silencedT=0; F[2].stunned=3; near(tickRatio(L,F[2],d),1.10*1.20,'rooted (the stun field)'); F[2].stunned=0;
  V.cast(v,'green'); land(); const b=mine(L,F[0],'toxbreath')[0]; assert.equal(b.remaining,7,'Lingering Cough 0.5 x 3 + Long Sickness 1.5 on 4 s: 7 s'); near(tickRatio(L,F[0],b),1.10*1.15,'Swamp Lungs: Toxic Breath\'s poison 3% x 5');
  near(skillRatio(L,F[1],'toxbreath'),1.15,'Swamp Lungs: its hit'); near(skillRatio(L,F[1],'plaguesov'),1.15,'Rotting Ground: Plague Sovereign 3% x 5');
  V.cast(v,'ult'); land(); near(tickRatio(L,F[0],mine(L,F[0],'plaguesov')[0]),1.10*1.15,'Rotting Ground: and its poison');
  v.hp=v.maxHp*0.5; const h0=v.hp, l=tickLoss(L,F[2],d); near(v.hp-h0,l*0.03,'Sickly Sweet: he heals 1% x 3 of the poison damage he deals',1e-6);
  near(hitOn(L,v,1000,{src:F[2]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[2]}))*0.97,'Marsh Gas: a poisoned enemy deals 1% x 3 less to him'); near(hitOn(L,A[0],1000,{src:F[2]}),plainHit(L,()=>hitOn(L,A[0],1000,{src:F[2]}))*0.97,'and to his allies');
  F[1].dots.length=0; near(hitOn(L,v,1000,{src:F[1]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[1]})),'not an enemy he has not poisoned');
  const L2=lab(H,S(['pk_9_4']),{foes:3}); const m1=L2.v.mrRating; poison(L2,L2.F[0]); poison(L2,L2.F[1]); land(); V.step(1); near(L2.v.mrRating,m1*(1+0.02*2),'Sick Kingdom: 0.4% x 5 magic resist for each living enemy he has poisoned');
  const L3=lab(H,S(['pk_9_3']),{foes:3}); const f=L3.F[1]; f.mrRating=300; const dm=VMX('defMul'), a=dm(L3.v,f,'magic'); f.mrRating=300*0.9; const c=dm(L3.v,f,'magic'); f.mrRating=300;
  near(skillRatio(L3,f,'swamproot','magic'),c/a,'Bitter Air: the hits of his skills ignore 2% x 5 of magic resist'); near(lost(f,()=>V.hit(L3.v,f,1000,{kind:'magic'})),plainHit(L3,()=>lost(f,()=>V.hit(L3.v,f,1000,{kind:'magic'}))),'not a basic attack');
});

test('Bloatus / where his skills go: Breath of the Drowned (2 Rot, toward the Carrier), Thick Fumes, The Sick King\'s Mark',()=>{
  { const L=lab(H,S(['pk_7_1','pk_1_1']),{foes:6}), {v,F}=L; for(const f of F) free(f); poison(L,F[3]); land(); V.step(1); assert.ok(mark(L,F[3],'car'));
    const h3=F[3].hp, h5=F[5].hp; V.cast(v,'green'); assert.ok(F[3].hp<h3,'the plume turns toward the Carrier (6 m away)'); near(F[5].hp,h5,'not to the farthest enemy');
    land(); assert.equal(ust(L,F[3],'rot'),3,'every enemy it poisons gets 2 Rot (and 1 for poisoning it again)');
    at(L,F[3],0,16); V.cast(v,'green'); land(); assert.ok(mine(L,F[5],'toxbreath').length>0,'the Carrier 16 m away: the farthest within 15 m as before'); }
  { const L=lab(H,S(['pk_4_3']),{foes:3}), {v,F}=L; for(const f of F) free(f); at(L,F[2],7,1.95); const h=F[2].hp; V.cast(v,'green'); assert.ok(F[2].hp<h,'Thick Fumes: the plume is 1.4 + 0.2 x 3 m wide each side: 1.95 m off the line is hit');
    at(L,F[2],7,2.1); const h2=F[2].hp; V.cast(v,'green'); near(F[2].hp,h2,'not 2.1 m'); }
  { const L=lab(H,null,{foes:3}), {v,F}=L; for(const f of F) free(f); at(L,F[2],7,1.6); const h=F[2].hp; V.cast(v,'green'); near(F[2].hp,h,'(without it: 1.6 m off the line is missed)'); }
  const L=lab(H,S(['pk_11_1','pk_1_1','pk_1_2']),{foes:6}), {v,F}=L; for(const f of F) free(f); poison(L,F[4]); land(); V.step(1); assert.ok(mark(L,F[4],'car'));
  const h=F.map(f=>f.hp); V.cast(v,'ult'); assert.ok(F[4].hp<h[4],'The Sick King\'s Mark: the ring centres on the Carrier (4.1 m away)'); near(F[0].hp,h[0],'not around him'); assert.equal(ust(L,F[4],'rot'),3,'every enemy it hits gets 3 Rot');
  at(L,F[4],5.5,14); V.step(1); const g=F.map(f=>f.hp); V.cast(v,'ult'); assert.ok(F[0].hp<g[0],'the Carrier more than 6 m away: around him as before');
});

test('Bloatus / Seeping (Swampcall poisons every enemy it roots: 5% x 5 of the hit a second, 3 s) and Royal Patience',()=>{
  const L=lab(H,S(['pk_6_2','pk_8_3']),{foes:3}), {v,F}=L; for(const f of F) free(f); noDef(L);
  const h=F[1].hp; V.cast(v,'blue'); const hit=h-F[1].hp; const s=mine(L,F[1],'seep'); assert.equal(s.length,1,'a poison of his'); near(s[0].dps,hit*0.25,''); assert.equal(s[0].remaining,3,'for 3 s');
  assert.equal(mine(L,F[0],'seep').length,0,'only the enemies it rooted'); near(FX.cd(v,'blue',10),10-0.9,'Royal Patience: Swampcall\'s cooldown 0.3 x 3 s shorter');
});

test('Bloatus / The Kingdom Falls Sick (SIGNATURE): at 10 Outbreak every enemy poisoned with 5 Rot, 6 s of Contagion without a range limit, 10 energy for each poisoned death',()=>{
  const L=lab(H,S(['pk_13_2','pk_1_4','pk_1_2']),{foes:4}), {v,F}=L; for(const f of F) free(f);
  setStack(L,'ob',9); poison(L,F[0]); land(); at(L,F[1],4.5,2.2); v.energy=0;
  kill(L,F[0]); assert.ok(win(L,'ksick'),'10 Outbreak: the plague takes the field'); for(const f of [F[1],F[2],F[3]]){ assert.equal(mine(L,f,'king').length,1,'every enemy poisoned'); assert.equal(ust(L,f,'rot'),5,'with 5 Rot'); }
  near(mine(L,F[2],'king')[0].dps,bp(L),'Toxic Breath\'s own poison'); assert.equal(mine(L,F[2],'king')[0].remaining,4,'for 4 s'); near(v.energy,0,'(F0 died before it)');
  F[3].dots.length=0; kill(L,F[2]); near(v.energy,10,'a poisoned enemy dies in the 6 s: 10 ultimate energy'); land(); assert.equal(mine(L,F[3],'spread').length,1,'Contagion with no range limit: F3 far away caught it');
  secs(6); setStack(L,'ob',9); F[1].dots.length=0; poison(L,F[1]); land(); at(L,F[3],F[1].x/V.METER-v.x/V.METER,F[1].y/V.METER-v.y/V.METER+2.2); F[3].dots.length=0;
  kill(L,F[1]); assert.ok(!win(L,'ksick'),'once per wave'); near(v.energy,10,'and no energy after its 6 s');
});

/* ============================== THE DROWNED COURT ============================== */
test('Bloatus / the Court: Hold Court, Courtiers, Loyal Subjects, Court Physician, Weight of the Crown, Bowed Heads, Large Court, Dismissed, Kingdom Under Water',()=>{
  const L=lab(H,S(['dc_1_4','dc_2_4','dc_4_4','dc_8_4','dc_6_4','dc_12_4','dc_10_4','dc_3_4','dc_12_3']),{foes:4,big:true}), {v,F}=L; for(const f of F) free(f);
  const ap0=v.apow, a1=F[1].dmg; v.hp=v.maxHp*0.5; const h0=v.hp; V.cast(v,'blue'); assert.ok(mark(L,F[1],'court')&&mark(L,F[2],'court'),'every enemy he roots or silences joins his Court'); assert.ok(!mark(L,F[0],'court'));
  near(v.hp-h0,v.maxHp*0.05*2,'Court Physician: 1% x 5 for each that joins',1e-6); V.step(2);
  near(hitOn(L,v,1000,{src:F[0]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[0]}))*(1-0.025*2),'Hold Court: 0.5% x 5 less for each member alive');
  near(hitOn(L,v,1000,{src:F[1]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[1]}))*(1-0.05)*(1-0.05),'Loyal Subjects: a member deals 1% x 5 less to him');
  near(v.apow,ap0*(1+0.009*2),'Weight of the Crown: 0.3% x 3 ability power per member'); near(F[1].dmg,a1*0.97,'Bowed Heads: each member 1% x 3 less attack');
  F[1].hp=F[1].maxHp*0.5; const g=-lost(F[1],()=>V.heal(F[1],1000)), g0=plainHit(L,()=>-lost(F[1],()=>V.heal(F[1],1000))); near(g,g0*0.90,'Large Court: members receive 2% x 5 less healing');
  near(L.T.P['court.max'],3,'Courtiers: 3 more members');
  near(skillRatio(L,F[1],'swamproot'),1,'not full: 2 of 4 enemies'); kill(L,F[0]); kill(L,F[3]); V.step(1); near(skillRatio(L,F[1],'swamproot'),1.10,'Kingdom Under Water: every enemy on the field is a member: his skills 2% x 5 more');
  F[2].silencedT=0; kill(L,F[1]); near(F[2].silencedT,0.5,'Dismissed: a member dies, every other member silenced 0.5 s',1e-9);
  V.wave(); V.step(1); assert.ok(!mark(L,F[2],'court'),'the Court is this wave\'s');
});

test('Bloatus / the Court holds 6 (Courtiers: more): a 7th pushes out the one that joined first',()=>{
  const L=lab(H,S(['dc_1_4']),{foes:8,big:true}), {v,F}=L; for(let i=0;i<7;i++){ free(F[i]); ccOn(v,F[i],'silencedT',1); } V.step(1);
  assert.equal(F.filter(f=>mark(L,f,'court')).length,6,'6 members'); assert.ok(!mark(L,F[0],'court'),'the first one is out'); assert.ok(mark(L,F[6],'court'),'the 7th is in');
  near(hitOn(L,v,1000,{src:F[7]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[7]}))*(1-0.025*6),'Hold Court counts 6');
});

test('Bloatus / Sick at Court (LINK) with Hold Court: the Carrier is a member, and a member that dies poisoned gives 1 Outbreak',()=>{
  const L=lab(H,S(['pk_n2','dc_1_4','pk_1_4']),{foes:3,big:true}), {v,F}=L; for(const f of F) free(f); poison(L,F[0]); land(); V.step(1);
  assert.ok(mark(L,F[0],'crt')&&!mark(L,F[0],'court'),'the Carrier counts as a member');
  near(hitOn(L,v,1000,{src:F[1]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[1]}))*(1-0.025),'Hold Court: 1 member'); const o=stack(L,'ob'); at(L,F[1],30,0); at(L,F[2],-30,0); kill(L,F[0]); assert.equal(stack(L,'ob'),o+1,'a member died poisoned: 1 Outbreak');
  const L2=lab(H,S(['pk_n2']),{foes:3}); poison(L2,L2.F[0]); land(); V.step(1); assert.ok(!mark(L2,L2.F[0],'crt'),'without Hold Court: not a member');
});

test('Bloatus / The Tide Answers (Plague Sovereign roots 0.8 s, and they join the Court) and Gilded Chains',()=>{
  const L=lab(H,S(['dc_11_3','dc_11_4','dc_1_4']),{foes:3}), {v,F}=L; for(const f of F) free(f);
  V.cast(v,'ult'); near(F[0].stunned,0.8,'rooted 0.8 s, in full',1e-9); assert.ok(mark(L,F[0],'court'),'and joins the Court'); near(F[1].stunned,0,'(not an enemy it missed)'); V.step(1);
  near(skillRatio(L,F[0],'toxbreath'),1.15,'Gilded Chains: Toxic Breath 3% x 5 more on a member'); near(skillRatio(L,F[1],'toxbreath'),1,'not on another enemy');
  L.T.s.cur='toxbreath'; poison(L,F[0]); L.T.s.cur=null; land(); near(tickRatio(L,F[0],mine(L,F[0],'toxbreath')[0]),1.15,'and its poison');
});

test('Bloatus / Command: By Royal Command, Raised Voice, First Petition, Standing Order, Heralds, Iron Etiquette, No Leave Given',()=>{
  const L=lab(H,S(['dc_1_1','dc_3_1','dc_6_1','dc_12_1','dc_10_1','dc_5_1','dc_7_1']),{foes:4,allies:1,big:true}), {v,F,A}=L; v.blueCd=20;
  const t0=V.now(); hitOn(L,v,10,{src:F[0]}); assert.equal(F[0].forcedTarget,v,'First Petition: ready at the wave\'s start; the next enemy that hits him must attack him'); near(F[0].forcedTargetT,1.5+1.0+1.0,'1.5 s + Raised Voice 0.2 x 5 + First Petition 0.5 x 2',1e-9);
  hitOn(L,v,10,{src:F[1]}); hitOn(L,v,10,{src:F[2]}); assert.equal(F[2].forcedTarget,v,'Standing Order: 2 more enemies while it lasts'); hitOn(L,v,10,{src:F[3]}); assert.ok(F[3].forcedTarget!==v,'not a 4th');
  near(v.blueCd,20-1.5*3,'Heralds: each Command 0.3 x 5 s off Swampcall');
  near(hitOn(L,v,1000,{src:F[0]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[0]}))*0.85,'Iron Etiquette: a Commanded enemy deals 3% x 5 less'); near(hitOn(L,A[0],1000,{src:F[0]}),plainHit(L,()=>hitOn(L,A[0],1000,{src:F[0]}))*0.85,'to anyone');
  near(hitOn(L,v,1000,{src:F[3]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[3]})),'not one that is not');
  poison(L,F[0]); land(); near(tickRatio(L,F[0],mine(L,F[0])[0]),1.06,'No Leave Given: 2% x 3 more poison damage');
  secs(t0+3.6-V.now()); assert.ok(!mark(L,F[0],'cmd'),'the Command is over'); secs(t0+9-0.2-V.now()); hitOn(L,v,10,{src:F[3]}); assert.ok(!mark(L,F[3],'cmd'),'ready again only after 12 - 3 s');
  secs(0.4); hitOn(L,v,10,{src:F[3]}); assert.ok(mark(L,F[3],'cmd'),'now'); near(F[3].forcedTargetT,2.5,'not the wave\'s first: 1.5 + 1.0 s',1e-9);
});

test('Bloatus / By Royal Command without First Petition: not ready at the wave\'s start',()=>{
  const L=lab(H,S(['dc_1_1']),{foes:3,big:true}), {v,F}=L; hitOn(L,v,10,{src:F[0]}); assert.ok(!mark(L,F[0],'cmd'),'it waits its 12 - 3 s'); secs(9.05); hitOn(L,v,10,{src:F[0]}); assert.ok(mark(L,F[0],'cmd')); near(F[0].forcedTargetT,1.5,'',1e-9);
});

test('Bloatus / Sovereign Right: Swampcall opens under a Commanded enemy first, and Commands it again for 1.5 s',()=>{
  const L=lab(H,S(['dc_9_1','dc_1_1','dc_10_1']),{foes:3,big:true}), {v,F}=L; for(const f of F) free(f); setMk(L,F[0],'cmd',0.5);
  v.blueCd=10; V.cast(v,'blue'); near(F[0].stunned,V.cap('stunned'),'the swamp opens under the Commanded enemy',1e-9); near(F[2].stunned,V.cap('stunned'),'and under the farthest other',1e-9); near(F[1].stunned,0,'not F1');
  near(v.blueCd,10-1.5,'a Command again (Heralds)'); assert.equal(F[0].forcedTarget,v,''); secs(1.2); assert.ok(mark(L,F[0],'cmd'),'Commanded again for 1.5 s (its own Command had 0.5 s left)'); secs(0.5); assert.ok(!mark(L,F[0],'cmd'),'');
});

test('Bloatus / Swampcall: Deep Swamp, Long Root, Drowned Ear, Royal Marsh; Waterlogged, Sodden, Silt in the Gears, Bog Fever',()=>{
  const L=lab(H,S(['dc_2_2','dc_4_2','dc_10_3','dc_7_4','dc_2_3','dc_4_3','dc_6_3','dc_8_3']),{foes:3,allies:1}), {v,F,A}=L; for(const f of F) free(f); F[1].speed=100;
  at(L,F[0],8,1.95); V.cast(v,'blue'); near(F[1].stunned,V.cap('stunned')+0.45,'Long Root: 0.15 x 3 s longer, in full (past the 2.8 s ceiling)',1e-9); near(F[1].silencedT,2.0+0.5,'Drowned Ear: the silence 0.1 x 5 s longer',1e-9);
  assert.ok(F[0].stunned>0,'Deep Swamp: 2.4 + 0.2 x 3 m: an enemy 2.79 m from the swamp\'s centre is caught');
  near(skillRatio(L,F[1],'swamproot'),1.15,'Royal Marsh: Swampcall 3% x 5 more');
  F[1].stunned=0.05; V.step(3); assert.ok(mark(L,F[1],'wl'),'Waterlogged when the root ends'); const e=L.T.s.au.find(x=>x.x===F[1]); near(e&&e.ap.cdRate,-0.10,'its cooldowns run 2% x 5 slower');
  near(F[1].speed,100*0.90,'Silt in the Gears: 2% x 5 slower');
  near(lost(F[1],()=>V.hit(A[0],F[1],1000,{kind:'true'})),plainHit(L,()=>lost(F[1],()=>V.hit(A[0],F[1],1000,{kind:'true'})))*1.075,'Bog Fever: 1.5% x 5 more from his whole team');
  secs(4+1.5-0.2-3*V.STEP); assert.ok(mark(L,F[1],'wl'),'Sodden: 4 + 0.5 x 3 s'); secs(0.4); assert.ok(!mark(L,F[1],'wl'),'then over'); V.step(2); near(F[1].speed,100,'');
  const L2=lab(H,null,{foes:3}); for(const f of L2.F) free(f); at(L2,L2.F[0],8,1.95); V.cast(L2.v,'blue'); near(L2.F[0].stunned,0,'(without Deep Swamp it is not)');
});

test('Bloatus / Lifted Out (PICK ONE) and Into the Reeds: the root ends, the enemy is pulled 1.5 m toward him and silenced',()=>{
  const L=lab(H,S(['dc_5_2','dc_6_2']),{foes:3}), {v,F}=L; for(const f of F) free(f); V.cast(v,'blue');
  F[1].stunned=0.02; F[1].silencedT=0; F[2].stunned=0.02; F[2].silencedT=1; V.step(2);
  assert.ok(F[1].pulledBy&&Math.abs(F[1].pulledBy.x-v.x)<1e-6,'pulled toward him'); near(F[1].pullSpeed,1.5*V.METER/0.3,'1.5 m over 0.3 s'); assert.ok(F[1].silencedT>0.6-2.5*V.STEP&&F[1].silencedT<=0.6+1e-9,'Into the Reeds: silenced 0.2 x 3 s: '+F[1].silencedT);
  assert.ok(F[2].silencedT>1.6-3.5*V.STEP&&F[2].silencedT<=1.6+1e-9,'a silence still on it: that much longer: '+F[2].silencedT);
});

test('Bloatus / Sunk to the Neck (PICK ONE): a Waterlogged enemy cannot be shielded or cleansed',()=>{
  const L=lab(H,S(['dc_5_3','dc_2_3']),{foes:3}), {F}=L; setMk(L,F[1],'wl'); F[1].shield=500; F[0].shield=500; F[1].shieldT=99; F[0].shieldT=99; V.step(1); near(F[1].shield,0,'its shield breaks'); near(F[0].shield,500,'not another enemy\'s');
  F[1].stunned=3; F[1].silencedT=2; V.dot(F[1],10,6,1,F[2]); V.step(1); const n=F[1].dots.length; F[1].stunned=0; F[1].silencedT=0; F[1].dots.length=0; V.step(1);
  assert.ok(F[1].stunned>2.9,'a cleanse cannot take its root'); assert.ok(F[1].silencedT>1.9,'or its silence'); assert.equal(F[1].dots.length,n,'or its DoTs');
});

test('Bloatus / Old Throne, Kept in Their Place, Throne Weight, Stubborn Ruler, Mud Throne, Mire Magic, Throne Room Air',()=>{
  const L=lab(H,S(['dc_7_2','dc_n1','dc_11_2','dc_12_2','dc_9_4','dc_9_2','dc_8_2']),{foes:3,allies:1,big:true}), {v,F,A}=L;
  near(hitOn(L,v,1000,{src:F[0]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[0]}))*(1-0.075),'Old Throne: two or more enemies rooted (the lab holds them all): 1.5% x 5 less');
  near(hitOn(L,A[0],1000,{src:F[0]}),plainHit(L,()=>hitOn(L,A[0],1000,{src:F[0]}))*0.90,'Kept in Their Place: a rooted enemy deals 2% x 5 less to his allies');
  near(lost(v,()=>V.hit(F[0],v,1000,{kind:'true',crit:true})),plainHit(L,()=>lost(v,()=>V.hit(F[0],v,1000,{kind:'true',crit:true})))*0.90*(1-0.075),'Throne Weight: 2% x 5 less from crits');
  v.hp=v.maxHp*0.5; const h0=v.hp; clk(L,'dc_9_4#0'); secs(1.02); near(v.hp-h0,v.maxHp*0.005,'Mud Throne: 0.1% x 5 a second while an enemy is rooted',1e-4);
  for(const f of F) free(f); near(hitOn(L,v,1000,{src:F[0]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[0]})),'none rooted: none of these');
  near(hitOn(L,A[0],1000,{src:F[0]}),plainHit(L,()=>hitOn(L,A[0],1000,{src:F[0]})),''); const h1=v.hp; secs(1.5); near(v.hp,h1,'');
  F[1].silencedT=2; near(hitOn(L,v,1000,{src:F[0]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[0]})),'one silenced: not yet'); F[2].silencedT=2; near(hitOn(L,v,1000,{src:F[0]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[0]}))*(1-0.075),'two: silenced counts');
  v.hp=v.maxHp*0.39; for(const f of F) free(f); near(hitOn(L,v,1000,{src:F[0]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[0]}))*0.94,'Stubborn Ruler: below 40% HP, 2% x 3 less');
  const f=F[1]; f.mrRating=300; const dm=VMX('defMul'), a=dm(v,f,'magic'); f.mrRating=270; const c=dm(v,f,'magic'); f.mrRating=300; near(skillRatio(L,f,'toxbreath','magic'),c/a,'Mire Magic: 2% x 5 of magic resist ignored');
  v.silencedT=0; ccOn(F[0],v,'silencedT',2); near(v.silencedT,2*V.ccNerf*0.70,'Throne Room Air: silences 10% x 3 shorter',1e-9); v.stunned=0; ccOn(F[0],v,'stunned',1); near(v.stunned,V.ccNerf,'(not a stun)',1e-9);
});

test('Bloatus / Long Live the King (SIGNATURE): a full Court is rooted, silenced, Commanded onto him and Waterlogged; 40% less for 3 s; once every 25 s',()=>{
  const L=lab(H,S(['dc_13_3','dc_1_4']),{foes:3,big:true}), {v,F}=L; for(const f of F) free(f);
  V.cast(v,'blue'); assert.ok(!win(L,'llk'),'two of three: not full'); ccOn(v,F[0],'silencedT',1); V.step(1);
  assert.ok(win(L,'llk'),'every enemy a member: he holds court'); for(const f of F){ assert.ok(f.stunned>=1.5-V.STEP-1e-9,'rooted 1.5 s'); assert.ok(f.silencedT>=2-V.STEP-1e-9,'silenced 2 s'); assert.equal(f.forcedTarget,v,'Commanded onto him'); assert.ok(f.forcedTargetT>3-2.5*V.STEP&&f.forcedTargetT<=3+1e-9,'for 3 s'); assert.ok(mark(L,f,'wl'),'Waterlogged'); }
  near(hitOn(L,v,1000,{src:F[0]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[0]}))*0.60*(1-0.025*3),'40% less for those 3 s (Hold Court on top, multiplied)');
  secs(3.1); assert.ok(!win(L,'llk'),'3 s'); secs(25-3.1-0.5); assert.ok(!win(L,'llk'),'once every 25 s (24.5 s: not yet)'); secs(0.6); assert.ok(win(L,'llk'),'again');
});

/* ============================== KEPT BY THE MARSH ============================== */
test('Bloatus / Bloat: Swell, Gassy, Thick Gut, Ballast, Wallow',()=>{
  const L=lab(H,S(['km_1_1','km_2_1','km_4_1','km_12_1','km_6_1']),{foes:3,big:true}), {v,F}=L;
  hitOn(L,v,10); assert.equal(stack(L,'bloat'),1,'each hit he takes: 1 Bloat'); near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*(1-0.01*1),'Thick Gut: 0.2% x 5 less per Bloat (1, as the hit reaches him)');
  for(let i=0;i<12;i++) hitOn(L,v,10); assert.equal(stack(L,'bloat'),10,'max 10');
  near(lost(F[0],()=>V.hit(v,F[0],1000,{kind:'true'})),plainHit(L,()=>lost(F[0],()=>V.hit(v,F[0],1000,{kind:'true'})))*1.09,'Ballast: at 10 Bloat 3% x 3 more');
  const h=lost(F[1],()=>V.hit(v,F[1],1000,{kind:'true',auto:true})); const w=mine(L,F[1],'wallow'); assert.equal(w.length,1,'Wallow: at 5+ Bloat a basic attack poisons'); near(w[0].dps,h*0.15,'5% x 3 of the hit a second'); assert.equal(w[0].remaining,2,'2 s');
  V.hit(v,F[1],1000,{kind:'true',auto:true}); assert.equal(mine(L,F[1],'wallow').length,1,'one at a time (refreshed)'); near(tickRatio(L,F[1],mine(L,F[1],'wallow')[0]),1.09,'Ballast: his poison too');
  v.hp=v.maxHp*0.5; const h0=v.hp; clk(L,'km_1_1#0'); secs(2.02); near(v.hp-h0,v.maxHp*0.0002*5*10*2,'Swell: each Bloat heals 0.02% x 5 of his max HP a second',1e-3);
  secs(8-2.1-0.2); assert.ok(stack(L,'bloat')>=10,'Gassy: they last 5 + 3 s'); secs(0.4); assert.equal(stack(L,'bloat'),0,'then lapse together');
});

test('Bloatus / Overfull (10% x 5 chance a hit gives 2 Bloat: the fight\'s seeded stream) and Gorge',()=>{
  const L=lab(H,S(['km_8_1','km_11_1']),{foes:3,big:true}), {v,F}=L; let one=0,two=0; for(let i=0;i<40;i++){ L.T.s.k.bloat={n:0,t:9,idle:0}; hitOn(L,v,10); const n=stack(L,'bloat'); if(n===1) one++; else if(n===2) two++; else assert.fail('Bloat '+n); }
  assert.ok(one>8&&two>8,'some hits 1, some 2: '+one+' / '+two);
  L.T.s.k.bloat={n:0,t:9,idle:0}; free(F[0]); poison(L,F[0]); land(); kill(L,F[0]); assert.equal(stack(L,'bloat'),1,'Gorge: an enemy that dies poisoned: 20% x 5 chance of 1 Bloat');
  L.T.s.k.bloat={n:0,t:9,idle:0}; F[1].dots.length=0; kill(L,F[1]); assert.equal(stack(L,'bloat'),0,'not an enemy without his poison');
});

test('Bloatus / Belch with Burst Seams and Belly Laugh: at 10 Bloat Toxic Breath spends them and poisons every enemy within 3 m',()=>{
  const L=lab(H,S(['km_3_1','km_10_1','km_7_1']),{foes:3}), {v,F}=L; for(const f of F) free(f); setStack(L,'bloat',9); v.hp=v.maxHp*0.5;
  V.cast(v,'green'); assert.equal(mine(L,F[0],'belch').length,0,'9 Bloat: no Belch'); setStack(L,'bloat',10); const h0=v.hp; V.cast(v,'green');
  assert.equal(stack(L,'bloat'),0,'all Bloat spent'); const b=mine(L,F[0],'belch'); assert.equal(b.length,1,'F0 (0.48 m) poisoned at once'); near(b[0].dps,bp(L)*1.20,'Toxic Breath\'s own poison, Burst Seams 4% x 5 stronger'); assert.equal(mine(L,F[1],'belch').length,0,'not F1 (6 m)');
  near(v.hp-h0,v.maxHp*0.009*10,'Belly Laugh: 0.3% x 3 for each Bloat spent',1e-6);
});

test('Bloatus / Reign: Long Reign, Rule by Waiting, Old Grievance, The Old King, Ancient Reign, Patience of Kings',()=>{
  const L=lab(H,S(['km_1_4','km_5_4','km_6_4','km_3_4','km_7_4','km_10_4']),{foes:3,big:true}), {v}=L;
  assert.equal(stack(L,'reign'),4,'Old Grievance: the wave starts with 2 x 2 Reign'); clk(L,'#8'); secs(5/1.5-0.1); assert.equal(stack(L,'reign'),4,''); secs(0.2); assert.equal(stack(L,'reign'),5,'Rule by Waiting: every 5 s / 1.5');
  setStack(L,'reign',8); V.step(1);
  near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*(1-0.075),'Ancient Reign: at 8 Reign 1.5% x 5 less'); setStack(L,'reign',7); near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000)),'not at 7');
  const L2=lab(H,S(['km_1_4','km_10_4','km_3_4']),{foes:3,big:true}), w=L2.v; const mr0=w.mrRating, ap0=w.apow, hp0=w.maxHp;
  setStack(L2,'reign',8); V.step(1); near(w.mrRating,mr0*(1+0.015*8),'Long Reign: 0.5% x 3 magic resist per Reign'); near(w.apow,ap0*(1+0.015*8),'and ability power'); near(w.maxHp,hp0*(1+0.01*8),'Patience of Kings: 0.2% x 5 max HP per Reign');
  w.hp=w.maxHp*0.5; const h0=w.hp; clk(L2,'km_3_4#0'); secs(1.02); near(w.hp-h0,w.maxHp*0.0002*5*8,'The Old King: 0.02% x 5 a second per Reign',1e-3);
});

test('Bloatus / Throne Not Abandoned: once per wave, below 30% with 8 Reign, he cannot drop below 1 HP for 2 s',()=>{
  const L=lab(H,S(['km_9_4']),{foes:3}), {v,F}=L; setStack(L,'reign',8); v.hp=v.maxHp*0.5; V.hit(F[0],v,v.maxHp*5,{kind:'true'}); assert.ok(v.alive,'a blow from 50% that would kill him'); near(v.hp,1,'leaves him at 1 HP');
  secs(1.5); V.hit(F[0],v,v.maxHp*5,{kind:'true'}); assert.ok(v.alive,'for 2 s'); secs(0.6); V.hit(F[0],v,v.maxHp*5,{kind:'true'}); assert.ok(!v.alive,'then once per wave');
  const L2=lab(H,S(['km_9_4']),{foes:3}); setStack(L2,'reign',7); L2.v.hp=L2.v.maxHp*0.5; V.hit(L2.F[0],L2.v,L2.v.maxHp*5,{kind:'true'}); assert.ok(!L2.v.alive,'not with 7 Reign');
});

test('Bloatus / Marshwater: filled by his poison\'s ticks, drunk below 50% HP; Deep Well, Spring Flood, The Rising Water, Brackish',()=>{
  const L=lab(H,S(['km_2_2','km_4_2','km_9_2','km_12_2','km_6_2']),{foes:3,big:true}), {v,F}=L; free(F[0]);
  poison(L,F[0],10,4); land(); secs(3.05); assert.equal(stack(L,'marsh'),3,'each tick of his poison: 1 Marshwater'); near(L.T.st.marsh.max,45,'Deep Well: 30 + 5 x 3');
  hitOn(L,v,10); assert.equal(stack(L,'marsh'),3+5,'Brackish: a skill (not a basic attack) that hits him: 1 x 5'); hitOn(L,v,10,{auto:true}); assert.equal(stack(L,'marsh'),8,'not a basic attack');
  setStack(L,'marsh',40); near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*(1-0.0005*5*40),'The Rising Water: 0.05% x 5 less per Marshwater held');
  setStack(L,'marsh',30); v.hp=v.maxHp*0.55; V.step(1); const ap0=v.apow; v.hp=v.maxHp*0.45; const h0=v.hp; V.step(1);
  near(v.hp-h0,v.maxHp*0.001*5*30,'below 50% HP he drinks it all: 0.1% x 5 of his max HP per Marshwater',1e-3); assert.equal(stack(L,'marsh'),0,''); V.step(1); near(v.apow,ap0*1.05,'Spring Flood: 1% x 5 ability power for 6 s');
  secs(6.1); near(v.apow,ap0,'then not'); setStack(L,'marsh',10); const h1=v.hp; V.step(2); near(v.hp,h1,'only as he drops below 50%');
});

test('Bloatus / Sip Slowly (PICK ONE): 5 at a time each second, 30% more',()=>{
  const L=lab(H,S(['km_2_2','km_5_2']),{foes:3,big:true}), {v}=L; setStack(L,'marsh',12); v.hp=v.maxHp*0.4; const h0=v.hp; clk(L,'km_5_2#0'); secs(1.02);
  near(v.hp-h0,v.maxHp*0.001*5*5*1.3,'one sip of 5',1e-3); assert.equal(stack(L,'marsh'),7); secs(2.0); assert.equal(stack(L,'marsh'),0,'5, then the last 2');
});

test('Bloatus / Spit the Brine (PICK ONE) and Bitter Brine: never drunk; each Toxic Breath spends 10 for 20% more damage (its poison too), and silences the first enemy hit',()=>{
  const L=lab(H,S(['km_2_2','km_5_3','km_6_3']),{foes:3,big:true}), {v,F}=L; for(const f of F) free(f); noDef(L); setStack(L,'marsh',25); v.hp=v.maxHp*0.4; V.step(2); assert.equal(stack(L,'marsh'),25,'never drunk');
  const a=lost(F[1],()=>V.cast(v,'green')); assert.equal(stack(L,'marsh'),15,'10 spent'); near(F[0].silencedT,0.6,'Bitter Brine: the first enemy it hits silenced 0.2 x 3 s',1e-9); near(F[1].silencedT,0,'only the first');
  land(); const p1=mine(L,F[1],'toxbreath')[0].dps; F[0].silencedT=0; setStack(L,'marsh',5); const b=lost(F[1],()=>V.cast(v,'green')); near(a,b*1.20,'20% more damage'); land(); near(p1,mine(L,F[1],'toxbreath')[1].dps*1.20,'its poison too');
  near(F[0].silencedT,0,'no Marshwater spent: no silence'); assert.equal(stack(L,'marsh'),5);
});

test('Bloatus / Sovereign Body: Plague Sovereign drinks every drop as it erupts, and every enemy it poisons fills 3',()=>{
  const L=lab(H,S(['km_11_2','km_2_2']),{foes:3,big:true}), {v,F}=L; for(const f of F) free(f); setStack(L,'marsh',20); v.hp=v.maxHp*0.8; const h0=v.hp;
  V.cast(v,'ult'); near(v.hp-h0,v.maxHp*0.001*5*20,'every drop drunk (above 50% HP too)',1e-3); assert.equal(stack(L,'marsh'),0); land(); assert.equal(stack(L,'marsh'),3,'F0 poisoned: 3');
});

test('Bloatus / The Marsh Keeps Him: a third swamp under him; 3 s of 2 Marshwater a second and he cannot be moved',()=>{
  const L=lab(H,S(['km_7_2']),{foes:3,big:true}), {v,F}=L; for(const f of F) free(f); at(L,F[0],1.9,0.2); V.cast(v,'blue');
  assert.ok(F[0].stunned>0,'the third swamp works as the others: an enemy within its 2.4 m of his centre is rooted'); V.step(1); assert.ok(v.immovable,'he cannot be moved'); secs(2.05); assert.equal(stack(L,'marsh'),4,'2 a second');
  secs(1.3); assert.ok(!v.immovable,'3 s'); assert.equal(stack(L,'marsh'),6,'2 a second for 3 s');
});

test('Bloatus / Royal Girth, Stubborn as Groll, Toad Throat (and the 50% silence cap), Drowned Patience, Peat Bog, Long-Lived, Sour Belly, Wet Lungs, Plague Lungs, Swamp Rot',()=>{
  const L=lab(H,S(['km_4_3','km_5_1','km_12_3','km_11_3','km_10_2','km_12_4','km_9_3','km_2_3','km_7_3','km_8_3']),{foes:3,big:true}), {v,F}=L;
  near(hitOn(L,v,1000,{src:F[0]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[0]}))*0.94,'Royal Girth: a front-row enemy, 2% x 3 less');
  v.stunned=0; ccOn(F[0],v,'stunned',1); near(v.stunned,V.ccNerf*0.80,'Stubborn as Groll: 4% x 5 shorter (its 20% cap)',1e-9); v.silencedT=0; ccOn(F[0],v,'silencedT',1); near(v.silencedT,V.ccNerf*0.8*0.8,'Toad Throat: silences 10% x 2 more',1e-9);
  V.dot(v,100,5,1,F[1]); const d=v.dots[v.dots.length-1]; const a=tickLoss(L,v,d); const T0=v._tal; v._tal=undefined; const b=tickLoss(L,v,d); v._tal=T0; near(a,b*0.90,'Drowned Patience: 2% x 5 less from DoTs');
  v.dots.length=0; v.hp=v.maxHp*0.6; const g=-lost(v,()=>V.heal(v,1e6)), g0=plainHit(L,()=>-lost(v,()=>V.heal(v,1e6))); near(g,g0*1.06,'Peat Bog: 2% x 3 more healing');
  v.hp=v.maxHp*0.4; near(-lost(v,()=>V.heal(v,1e6)),g0*1.06*1.09,'Long-Lived: below 50% HP 3% x 3 more');
  hitOn(L,v,10,{src:F[0]}); const s=mine(L,F[0],'sour'); assert.equal(s.length,1,'Sour Belly: a melee attacker poisoned'); near(s[0].dps,v.apow*0.05,'1% x 5 of his ability power a second'); assert.equal(s[0].remaining,2,'2 s');
  hitOn(L,v,10,{src:F[0]}); assert.equal(mine(L,F[0],'sour').length,1,'one at a time'); near(tickRatio(L,F[0],mine(L,F[0],'sour')[0]),1.10,'Swamp Rot: 2% x 5');
  near(FX.cd(v,'green',7),7-0.9,'Wet Lungs: Toxic Breath 0.3 x 3 s shorter'); near(skillRatio(L,F[1],'toxbreath'),1.15,'Plague Lungs: 3% x 5');
  const L2=lab(H,S(['km_5_1','km_12_3','dc_8_2']),{foes:3,big:true}); L2.v.silencedT=0; ccOn(L2.F[0],L2.v,'silencedT',1); near(L2.v.silencedT,V.ccNerf*0.50,'with Throne Room Air: 0.8 x 0.8 x 0.7 is cut at 50% shorter',1e-9);
});

test('Bloatus / He Would Not Leave the Throne (SIGNATURE): once per fight he would fall: every drop drunk at double healing, 10 Bloat, 5 s at 1 HP, enemies within 4 m poisoned each second',()=>{
  const L=lab(H,S(['km_13_2','km_2_2']),{foes:3}), {v,F}=L; for(const f of F) free(f); setStack(L,'marsh',20); v.hp=v.maxHp*0.2;
  V.hit(F[0],v,v.maxHp*5,{kind:'true'}); assert.ok(v.alive,'the marsh keeps him'); near(v.hp,1+v.maxHp*0.001*5*20*2,'every drop at double healing',1e-6); assert.equal(stack(L,'bloat'),10,'10 Bloat');
  const t=mine(L,F[0],'throne'); assert.equal(t.length,1,'an enemy within 4 m poisoned'); near(t[0].dps,bp(L),'one second of Toxic Breath\'s poison'); assert.equal(mine(L,F[1],'throne').length,0,'not one 6 m away');
  secs(1.05); assert.ok(mine(L,F[0],'throne').length>=1,'each second'); V.hit(F[0],v,v.maxHp*5,{kind:'true'}); assert.ok(v.alive,'he cannot drop below 1 HP'); near(v.hp,1,'');
  secs(4.1); V.hit(F[0],v,v.maxHp*5,{kind:'true'}); assert.ok(!v.alive,'after 5 s, and once per fight');
});

/* ============================== WHOLE FIGHTS ============================== */
const units=()=>VMX('units');
test('Bloatus: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['pk_1_1','pk_1_2','pk_1_4','pk_3_4','pk_4_1','pk_12_1','pk_6_4','pk_6_2','dc_1_1','dc_1_4','dc_2_3','km_1_1','km_1_4','km_2_2']), TEAM=['vael','sylthaine','vireo','vex','bloatus'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  const mx={}; let rot=0,car=false,court=0,cmd=false,wl=false,tags={};
  for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ V.step(1); const T0=s._tal.s; for(const k in T0.k) mx[k]=Math.max(mx[k]||0,T0.k[k].n);
    let c=0; for(const f of units().filter(u=>u.team==='enemy')){ const o=f._talM&&f._talM[s.uid]; for(const d of (f.dots||[])) if(d._talO===s.uid) tags[d._talK]=1; if(!o) continue; if(o.car) car=true; if(o.court&&f.alive) c++; if(o.cmd&&o.cmd.until>V.now()) cmd=true; if(o.wl&&o.wl.until>V.now()) wl=true; if(o['#rot']&&o['#rot'].until>V.now()) rot=Math.max(rot,o['#rot'].v); } court=Math.max(court,c); }
  assert.ok(tags.toxbreath&&tags.plaguesov,'real casts made his poison his: '+Object.keys(tags)); assert.ok(rot>=1,'real poisons gave Rot: '+rot); assert.ok(car,'a real Carrier'); assert.ok(court>=2,'real roots made a Court: '+court);
  assert.ok(cmd,'a real Command'); assert.ok(wl,'a real Waterlogged'); assert.ok(mx.bloat>=3,'real hits gave Bloat: '+mx.bloat); assert.ok(mx.reign>=1,'Reign: '+mx.reign); assert.ok(mx.marsh>=3,'real poison ticks filled Marshwater: '+mx.marsh); assert.ok(tags.spread,'a real Contagion spread (body to body)');
  console.log('  live fight: max '+JSON.stringify(mx)+', Rot '+rot+', Court '+court+', tags '+Object.keys(tags).join(','));
  determinism(H,TEAM);
});

/* The page sites his talents added (the poisQ / pois hooks of the poison queue, Contagion's reach and spread, the breath's aim and width, Plague Sovereign's
   centre): with nothing learned, whole seeded fights with Bloatus in the line-up are identical to the pre-talent page (ee8edab8), seed by seed. */
const BASE_SHA=process.env.TALENT_BASE||'9f1c2762f837a56a68e9315f7c0cab83a9f8ea2f';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-'));
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); return SH.load(path.join(dir,'emberweave-heroes.html')); }
let BASE=null; try{ BASE=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+') - the identity check against it is skipped'); }
test('Bloatus: no talents - whole fights with him in the line-up are identical to the pre-talent page, and they reach every site his talents added',{skip:!BASE},()=>{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['bloatus','vael','vireo','sylthaine','gruel'], foeTeam=['ambrel','fritz','dandra','konwu','ceraline'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>spec(k,70))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __blN={breath:0,sov:0,swamp:0,queued:0,spread:0,site:0}; var __blD=_doEffectCore, __blP=plagueDot, __blR=ringBurst;'+
    'ringBurst=function(x,y,c,n){ if(c===0x8fbf3f&&n===12) __blN.site++; return __blR.apply(this,arguments); };'+
    'plagueDot=function(t,dps,dur,iv,color,src){ if(src&&src.key==="bloatus"){ __blN.queued++; if(dur!==4&&dur!==5) __blN.spread++; } return __blP.apply(this,arguments); };'+
    '_doEffectCore=function(u,type,o){ if(u&&u.key==="bloatus"&&(!o||!o.deliver||o._arrived)){ if(type==="toxbreath") __blN.breath++; if(type==="plaguesov") __blN.sov++; if(type==="swamproot") __blN.swamp++; } return __blD.apply(this,arguments); };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>spec(k,68)))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'him on the other side, seed '+seed); n+=2; }
    const c=VMX('__blN'); console.log('  identity: '+JSON.stringify(c));
    assert.ok(c.breath>0&&c.sov>0&&c.swamp>0&&c.queued>0&&c.site>0,'the fights cast Toxic Breath ('+c.breath+'), Plague Sovereign ('+c.sov+') and Swampcall ('+c.swamp+'), queued his poisons ('+c.queued+') and poisoned enemies died, so the Contagion site ran ('+c.site+'): every new site was run'); }
  finally{ VMX('_doEffectCore=__blD; plagueDot=__blP; ringBurst=__blR;'); }
  assert.ok(n>=18);
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and a build that sits at that ceiling (or is immune) for more than half a battle is too strong.
   His damage reduction talents (and armor / magic resist / max HP), each candidate build at 91 points legal; the most defensive one is the one whose worst hit is reduced most. */
const DEF={ pk:['pk_5_4','pk_6_1','pk_n2','pk_10_3','pk_12_3','pk_12_4','pk_6_4','pk_1_4','pk_9_4'],
            dc:['dc_1_4','dc_2_4','dc_7_2','dc_4_4','dc_5_1','dc_11_2','dc_12_2','dc_13_3','dc_1_2','dc_3_2','dc_n2','dc_1_1','dc_8_2','dc_12_3','dc_11_3'],
            km:['km_4_1','km_4_3','km_7_4','km_11_3','km_12_2','km_13_2','km_1_3','km_3_3','km_n1','km_9_4','km_4_2','km_1_1','km_6_4','km_11_2'] };
/* tree by tree, in that order: that tree's defensive talents (and their prerequisites) first, the cheapest open talent of the tree to reach the next tier, until
   that tree has all it wants, its cap (61 + 30, 91) or 91 points are spent; then the next tree. Points left: the cheapest open talents */
function defensive(order,caps){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={pk:0,dc:1,km:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of DEF[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
/* the worst hit on him: every condition of his damage-reduction talents true at once (the attacker is the Carrier, poisoned, Commanded, a front-row member of a
   9-strong Court; every enemy rooted; he is below 40% HP inside Long Live the King's 3 s with 10 Bloat, 8 Reign, 45 Marshwater and 14 Outbreak), as a normal hit and
   as a critical one. Measured through the engine: what reaches his HP and shield against the hit */
function worstHit(list,kind,crit){ const L=lab(H,list,{foes:9,cold:true}), {v,F}=L; V.step(1); const f=F[0], now=V.now();
  if(L.T){ const M=x=>(x._talM||(x._talM={}))[v.uid]||(x._talM[v.uid]={}); for(const x of F){ M(x).crt={t0:now,until:1e9,v:0}; M(x).court={t0:now,until:1e9,v:0}; } M(f).car={t0:now,until:1e9,v:0}; L.T.s.m.car=f; M(f).cmd={t0:now,until:1e9,v:0};
    V.dot(f,1,99,1,v); const d=f.dots[f.dots.length-1]; d._talO=v.uid; d._talK='other'; L.T.s.w.llk={t:99,n:1,cdT:1e9,at:-1,wave:false};
    setStack(L,'bloat',10); setStack(L,'reign',8); setStack(L,'marsh',L.T.st.marsh.max); setStack(L,'ob',L.T.st.ob.max); }
  V.step(1); v.maxHp=1e5; v.hp=3.5e4; v.shield=1e12; v.shieldT=999; for(const x of F) x.stunned=1e6;
  const raw=1e6, x=lost(v,()=>V.hit(f,v,raw,{kind,crit})), cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1; return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Bloatus: his most defensive legal 91-point build never takes more than 95% off a hit, and never sits at that ceiling (or immune) in a seeded fight',()=>{
  const cands=[[['dc','km'],[61,30]],[['km','dc'],[61,30]],[['dc'],[91]],[['km'],[91]],[['dc','pk'],[61,30]],[['km','pk'],[61,30]],[['pk','dc'],[61,30]],[['pk','km'],[61,30]],[['dc','km','pk'],null]].map(([o,c])=>{ const b=defensive(o,c); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; for(const kind of ['magic','phys']) for(const crit of [false,true]) c.worst=Math.max(c.worst,worstHit(c.list,kind,crit)); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' '+(c.worst*100).toFixed(1)+'%').join(' | '));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.95,'the worst possible hit on his most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 95%');
  VMX('var __dr={max:0,n:0,at:0,imm:0,ticks:0,hi:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="bloatus"&&src&&src.team!==tgt.team; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); tgt._critHit=false; } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive&&!tgt._critHit){ const l=h0-tgt.hp-(tgt.shield||0), raw=amt*elemMul(src,tgt); if(raw>0&&l>0){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(u&&u.key==="bloatus"&&u.alive){ __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++; } } return __ubc.apply(this,arguments); };');
  try{ const sn=snaps(['vael','sylthaine','vireo','vex','bloatus'].map(k=>Object.assign(spec(k,100,k===H?best.list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','fritz'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const d=VMX('__dr'); console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%); seeded fights: '+d.n+' hits, the most reduced '+(d.max*100).toFixed(1)+'%, 85% or more '+d.hi+', at the ceiling '+d.at+', immune ticks '+d.imm+' of '+d.ticks);
    assert.ok(d.n>50&&d.ticks>500,'hits on him: '+d.n);
    assert.ok(d.max<0.95,'no hit on him was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0,'so he never sits at the ceiling'); assert.equal(d.imm,0,'and he is never immune'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});
