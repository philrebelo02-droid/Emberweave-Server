'use strict';
/* Vireo's talents as data on the mechanics layer (talents-mech/vireo.js), group by group on the still field (tests/talents-lab.js),
   then whole fights. Each group: the effect happens, has the right size, at the right time, and stops when it should.
   Run: node --test tests/talents-mech-vireo.test.js */
const test=require('node:test'),assert=require('node:assert/strict');
const {FX,FXN,T,V,near,secs,lab,lost,stack,mark,full,accounting,determinism,snaps,spec}=require('./talents-lab.js');
const H='vireo', S=ids=>full(H,ids);
test.afterEach(()=>{ FX.define(H,null); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{t:0,idle:0},{n}); };
const room=(L,hp)=>{ L.A.forEach((a,i)=>{ a.maxHp=1e6; a.hp=(hp&&hp[i]!=null)?hp[i]:5e5; }); };   // allies with room to heal
const gain=(a,fn)=>{ const h=a.hp; fn(); return a.hp-h; };
/* Dissonance on an enemy, read as the runtime reads it (lapses `dur` after the last gain, or one stack at a time with Afterring) */
const dis=(L,t)=>{ const o=t._talM&&t._talM[L.v.uid], m=o&&o['#dis']; if(!m) return 0; const now=V.now(), st=L.T.st.dis.step||0;
  if(now<m.until) return m.v; if(!(st>0)) return 0; return Math.max(0,m.v-(Math.floor((now-m.until)/st+1e-9)+1)); };
const setDis=(L,t,n)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o['#dis']={v:n,until:V.now()+L.T.st.dis.dur}; };
const markUntil=(L,t,name)=>{ const m=t._talM&&t._talM[L.v.uid]&&t._talM[L.v.uid][name]; return m?m.until:null; };
const plain=(o,fn)=>fn(lab(H,null,o));   /* a lab with no talents, run BEFORE the talented one (one field at a time) */
const same=(a,b,msg)=>assert.equal(JSON.stringify(a),JSON.stringify(b),msg);
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };   // the same hit with her talents switched off

test('Vireo: every talent is accounted for - 8 plain stats, 113 with rows (2 in part), none waiting with nothing wired',()=>{
  accounting(H,[121,8,113,0,2]);
  const M=FXN.mech(H); for(const id of ['lh_1_1','ds_1_1','li_1_1','lh_13_2','ds_13_2','li_13_2']) assert.ok(M.talents[id],id);
});

test('Vireo / Listening: Rapt Attention, Hushed Hall, Front Row, Rapt Crowd, Sing Along, Spellbound, Stage Presence, Listen Closely, Second Verse',()=>{
  const ids=['lh_1_1','lh_2_1','lh_3_1','lh_4_1','lh_n2','lh_5_1','lh_11_1','lh_8_1','lh_6_1'];
  const O={foes:2,allies:3,big:true}, HP=[5e5,5e5,3e5];
  const pl=plain(O,P=>{ room(P,HP); const a=gain(P.A[0],()=>V.cast(P.v,'green')), c=P.A[2].hp-3e5; P.A[0].hp=5e5; return [a,c,gain(P.A[0],()=>V.cast(P.v,'green'))]; });
  const L=lab(H,S(ids),O), {v,A,F}=L; room(L,HP);
  const baseA=plainHit(L,()=>lost(A[0],()=>V.hit(F[0],A[0],1000))), baseV=plainHit(L,()=>lost(v,()=>V.hit(F[1],v,1000))), baseOut=plainHit(L,()=>lost(F[1],()=>V.hit(A[0],F[1],1000))), baseAuto=plainHit(L,()=>lost(F[1],()=>V.hit(A[0],F[1],1000,{auto:true})));
  room(L,HP); assert.ok(!mark(L,A[0],'listen'),'nobody is Listening before her first heal');
  V.cast(v,'green');
  near(A[0].hp-5e5,pl[0],'the first heal: nobody was Listening yet (Listen Closely), A0 is above 40%'); near(A[2].hp-3e5,pl[1]*1.10,'Second Verse: 2% x 5 more on an ally below 40%');
  for(const a of A) assert.ok(mark(L,a,'listen'),'Rapt Attention: every ally she heals is Listening'); assert.ok(!mark(L,v,'listen'),'she herself is not');
  near(markUntil(L,A[0],'listen')-V.now(),4+1.5,'Hushed Hall: 4 s + 0.5 s x 3');
  near(lost(v,()=>V.hit(F[1],v,1000)),baseV*0.925,'Stage Presence: with 3 allies Listening she takes 1.5% x 5 less');
  near(lost(A[0],()=>V.hit(F[0],A[0],1000)),baseA*0.95,'a Listening ally takes 1% x 5 less'); near(lost(A[2],()=>V.hit(F[1],A[2],1000)),baseA*0.95*0.92,'Front Row: the lowest-HP Listening ally a further 8% less');
  near(lost(F[1],()=>V.hit(A[0],F[1],1000)),baseOut*1.05,'Rapt Crowd: a Listening ally deals 1% x 5 more'); near(lost(F[1],()=>V.hit(A[0],F[1],1000,{auto:true})),baseAuto*1.05*1.02,'Sing Along: and 2% more with a basic attack');
  V.hit(F[0],A[0],10); near(lost(v,()=>V.hit(F[0],v,1000)),baseV*0.925*0.95,'Spellbound: an enemy that hit a Listening ally deals 1% x 5 less (to her too)'); near(lost(A[1],()=>V.hit(F[0],A[1],1000)),baseA*0.95*0.95,'and to her allies');
  secs(2.05); near(lost(v,()=>V.hit(F[0],v,1000)),baseV*0.925,'for 2 s');
  A[0].hp=5e5; near(gain(A[0],()=>V.cast(v,'green')),pl[2]*1.06,'Listen Closely: 2% x 3 more on a Listening ally');
  secs(5.2+5.3); assert.ok(mark(L,A[0],'listen'),'her mending keeps them Listening: 5.5 s after its last tick'); secs(0.5); assert.ok(!mark(L,A[0],'listen'),'then it ends');
  near(lost(A[2],()=>V.hit(F[0],A[2],1000)),baseA,'no Listening: no reduction'); near(lost(v,()=>V.hit(F[1],v,1000)),baseV,'no Stage Presence');
});

test('Vireo / Full House: 4 Listening allies give her 3% x 3 healing power',()=>{
  const sn=snaps([spec(H,100,S(['lh_1_1','lh_10_1'])),spec('vael',100),spec('vael',100),spec('vael',100),spec('vael',100)]), en=snaps([spec('vael',100)]);
  const U=V.arena(sn,en,3), v=U[0]; for(const u of U){ u.stunned=1e6; if(u!==v){ u.maxHp=1e6; u.hp=5e5; } } V.step(1); const hp0=v.healPowMul;
  V.cast(v,'green'); V.step(1); near(v.healPowMul,hp0*1.09,'four allies Listening'); const al=U.filter(u=>u.team==='ally'&&u!==v); al[0]._talM[v.uid].listen.until=V.now(); V.step(1); near(v.healPowMul,hp0,'three: no bonus');
});

test('Vireo / Held Note: Held Note, Sustain, The Long Note',()=>{
  const L=lab(H,S(['lh_2_2','lh_4_2','lh_12_2']),{foes:2,allies:1,big:true}), {v,A,F}=L; room(L);
  V.cast(v,'green'); const hps=A[0].hots[0].hps; assert.ok(A[0].hots[0]._talU===v,'her mending is hers');
  secs(4.6); assert.equal(A[0].hots.length,1); secs(0.5); assert.equal(A[0].hots.length,1,'the mending ended and the Held Note took over'); const h=A[0].hots[0];
  near(h.hps,hps*0.50*1.15,'10% x 5 of its strength, The Long Note 3% x 5 more'); assert.equal(h.remaining,5+3,'Sustain: up to 5 s + 1 s x 3'); assert.ok(!v.hots.some(x=>x._talK==='held'),'not on herself');
  near(gain(A[0],()=>secs(1.0)),hps*0.575,'it heals each second');
  V.hit(F[0],v,10); assert.equal(A[0].hots.length,0,'Vireo is hit: the Held Note stops'); near(gain(A[0],()=>secs(1.1)),0,'');
  const M=lab(H,S(['lh_2_2']),{foes:1,allies:1,big:true}); room(M); V.cast(M.v,'green'); secs(5.1); assert.equal(M.A[0].hots[0].remaining,5); secs(5.1); assert.equal(M.A[0].hots.length,0,'unhit, it lasts its 5 s');
});

test('Vireo / Encore: Encore, Encore Bell, Bis, Curtain Call, Last Bow, Bravo, Unbroken Tone',()=>{
  const L=lab(H,S(['lh_1_1','lh_4_4','lh_12_4','lh_8_4','lh_5_4','lh_10_4','lh_7_4','lh_11_4']),{foes:2,allies:3}), {v,A,F}=L; A.forEach(a=>{ a.maxHp=1e5; a.hp=5e4; a.glyphDR=0; }); const hp0=v.healPowMul;
  const base=plainHit(L,()=>lost(A[1],()=>V.hit(F[0],A[1],1000)));
  V.cast(v,'green'); A[0].hp=100; const b1=A[1].hp, b2=A[2].hp; V.hit(F[0],A[0],5e6);
  assert.ok(A[0].alive,'Encore: a Listening ally that would die stays alive'); near(A[0].hp,1+1e5*0.24*1.15,'at 1 HP, then healed 8% x 3 of their max HP, Encore Bell 5% x 3 more');
  near(A[0].shield,1e5*0.10,'Bis: a shield of 5% x 2 of their max HP'); near(A[0].shieldT,5,'(reading: 5 s, as her Perfect Pitch shields)');
  near(A[1].hp-b1,1e5*0.06,'Last Bow: every other ally heals 2% x 3'); near(A[2].hp-b2,1e5*0.06,'');
  A[0].shield=0; near(lost(A[0],()=>V.hit(F[0],A[0],1000)),base*0.95*0.80,'Curtain Call: the saved ally takes 4% x 5 less (and Listening 5%)'); secs(3.05); A[0].shield=0; near(lost(A[0],()=>V.hit(F[0],A[0],1000)),base*0.95,'for 3 s');
  near(v.healPowMul,hp0*1.10,'Bravo: 2% x 5 healing power for each ally Encore saved');
  A.forEach(a=>{ a.hp=5e4; a.shield=0; }); const g0=gain(A[0],()=>{}), x0=A[0].hp, x1=A[1].hp; V.cast(v,'green'); near((A[0].hp-x0)/(A[1].hp-x1),1.15,'Unbroken Tone: her heals on that ally are 3% x 5 stronger',1e-6); assert.equal(g0,0);
  A[0].hp=10; A[0].shield=0; V.hit(F[0],A[0],5e6); assert.ok(!A[0].alive,'once per fight for each ally');
  const N=lab(H,S(['lh_4_4']),{foes:1,allies:1}); N.A[0].maxHp=1e5; N.A[0].hp=10; V.hit(N.F[0],N.A[0],5e6); assert.ok(!N.A[0].alive,'an ally that is not Listening is not caught');
});

test('Vireo / Harmony: Wide Dome, Choir Dome, Resounding Dome, Harmonic Swell, Dome Song; Silent Dome and Hum of the Dome',()=>{
  /* the most wounded ally is A0 (0,-5.5): the dome covers A0, A1 (5.5 m from it) and Vireo; A2 (11 m) is outside its 10 m */
  const hp=[4e5,6e5,7e5], O={foes:2,allies:3};
  const [s0,s2,pg0,pg2]=plain(O,P=>{ room(P,hp); V.cast(P.v,'blue'); const r=[P.A[0].shield,P.A[2].shield||0]; const a0=P.A[0].hp, a2=P.A[2].hp; V.cast(P.v,'green'); return r.concat([P.A[0].hp-a0,P.A[2].hp-a2]); });
  assert.ok(s0>0&&!(s2>0)); const L=lab(H,S(['lh_3_3','lh_7_2','lh_9_2','lh_9_3']),O); room(L,hp); const {v,A}=L; V.cast(v,'blue');
  near(A[0].shield,s0*1.15,'Wide Dome: Harmony shields 3% x 5 more'); assert.ok(mark(L,A[0],'listen')&&mark(L,A[1],'listen')&&!mark(L,A[2],'listen'),'Choir Dome: every ally inside is Listening');
  near(markUntil(L,A[0],'listen')-V.now(),12,'for the dome\'s whole 12 s');
  const a0=A[0].hp, a2=A[2].hp; secs(1.02); near(A[0].hp-a0,1e6*0.02,'it mends 1% + 0.2% x 5 of their max HP each second'); assert.equal(A[2].hp,a2,'not outside');
  A[0].hp=4e5; A[2].hp=7e5; const la0=A[0].hp, la2=A[2].hp; V.cast(v,'green');
  near(A[0].hp-la0,pg0*1.15,'Harmonic Swell: Crescendo heals 3% x 5 more inside Harmony'); near(A[2].hp-la2,pg2,'not outside');
  A[2].hp=1e5; V.cast(v,'blue'); assert.ok(markUntil(L,A[2],'listen')-V.now()>11.9,'a new Harmony on the new most wounded ally (A2)'); assert.ok(markUntil(L,A[0],'listen')-V.now()<11,'replaces the old dome: A0 (11 m from A2) is no longer inside');
  secs(12.1); const z=L.T.s.zn.harm.filter(q=>q.until>V.now()); assert.equal(z.length,0,'the dome is gone after 12 s'); const b0=A[0].hp; secs(1.05); near(A[0].hp,b0,'and so is its mending',1e-9);
  /* Dome Song: when Harmony ends (its 12 s, or the next Harmony replacing it) every ally that was inside heals 50% of the shield they still hold */
  const D=lab(H,S(['lh_11_2']),{foes:1,allies:3}); room(D,hp); V.cast(D.v,'blue'); D.A[0].shield*=0.6; secs(11.9); const sh=D.A[0].shield, h0=D.A[0].hp, h2=D.A[2].hp; secs(0.2);
  near(D.A[0].hp-h0,sh*0.5,'Dome Song: 50% of the shield left unbroken'); near(D.A[2].hp,h2,'not an ally that was outside');
  V.cast(D.v,'blue'); secs(5); D.A[1].shield=1000; const k1=D.A[1].hp; V.cast(D.v,'blue'); near(D.A[1].hp-k1,500,'a new Harmony replaces the one still up: it ends first');
  /* Silent Dome + Hum of the Dome: enemies inside gain 1 Dissonance a second and move 20% + 5% x 3 slower. F0 (7.1 m from A0) is inside, F1 (11.4 m) is not */
  const Q=lab(H,S(['ds_1_1','ds_5_3','ds_6_3']),{foes:2,allies:3}); room(Q,hp); V.cast(Q.v,'blue'); secs(1.05);
  assert.equal(dis(Q,Q.F[0]),1,'1 Dissonance a second inside'); assert.equal(dis(Q,Q.F[1]),0,'not outside'); near(Q.F[0].slowMul,0.65,'slowed 35%'); assert.ok(!(Q.F[1].slow>0));
  secs(2); assert.equal(dis(Q,Q.F[0]),3); Q.F[0].x+=40*V.METER; secs(1.1); assert.equal(dis(Q,Q.F[0]),3,'stepping out stops it'); assert.ok(!(Q.F[0].slow>0),'and the slow');
});

test('Vireo / Perfect Pitch: Warm Tone, Bright Timbre, Mastery of Song, Shrill Pitch',()=>{
  const O={foes:2,allies:2}, [pp,raw]=plain(O,P=>{ room(P,[5e5,1e6]); V.cast(P.v,'green'); return [P.A[0].shield,P.A[0].hp-5e5]; }); assert.ok(pp>0);
  const L=lab(H,S(['lh_2_3','lh_8_3','lh_12_3']),O); room(L,[5e5,1e6]); const {v,A}=L; V.cast(v,'green');
  near(A[0].shield,pp*1.12,'Warm Tone: Perfect Pitch shields 4% x 3 larger'); near(A[0].shieldT,5+2,'Bright Timbre: 0.4 s x 5 longer');
  near(A[1].shield,pp*1.12+raw*0.30,'Mastery of Song: the heal wasted on a full-HP ally: 10% x 3 of it is added to the shield');
  const hps=A[1].hots[0].hps, s1=A[1].shield; secs(1.02); near(A[1].shield-s1,hps*0.30,'each tick of her mending too',1e-6);
  V.cast(v,'ult'); near(A[0].shieldT,6+2,'Grand Symphony\'s Perfect Pitch: 6 s + 2 s');
  const N=lab(H,S(['lh_12_3']),{foes:1,allies:1}); room(N,[1e6]); N.v.pass=null; V.cast(N.v,'green'); assert.ok(!(N.A[0].shield>0),'without Perfect Pitch there is no Perfect Pitch shield to add to');
  const Q=lab(H,S(['ds_1_1','ds_7_2']),{foes:2,allies:1}); room(Q); V.cast(Q.v,'green'); assert.equal(dis(Q,Q.F[0]),2,'Shrill Pitch: the shield adds 1 Dissonance to the enemy nearest that ally (and Off Key 1)'); assert.equal(dis(Q,Q.F[1]),0);
});

test('Vireo / Crescendo rings: Breath Control, Swelling Chorus, Long Swell, Steady Choir, Even Breath',()=>{
  const B=lab(H,S(['lh_n1']),{foes:1}); near(FX.cd(B.v,'green',7),7-0.6,'Breath Control: 0.2 s x 3 off Crescendo');
  const six=X=>{ room(X); const g=[], sh=[]; for(let i=0;i<6;i++){ X.A[0].hp=5e5; X.A[0].shield=0; g.push(gain(X.A[0],()=>V.cast(X.v,'green'))); sh.push(X.A[0].shield); } return [g,sh,X.A[0].hots[X.A[0].hots.length-1].hps]; };
  const [pl,ps,phps]=plain({foes:1,allies:1},six); const L=lab(H,S(['lh_5_2','lh_6_2']),{foes:1,allies:1}), [tl,ts,thps]=six(L);
  for(let i=0;i<4;i++) near(tl[i],pl[i],'ring '+(i+1)+': as the game'); near(pl[4],pl[3],'the game stops at 4 rings');
  near(tl[4],pl[3]*2.00/1.75*1.15,'Swelling Chorus: ring 5 is 25% louder again; Long Swell 5% x 3 more'); near(tl[5],pl[3]*2.25/1.75*1.15,'ring 6'); assert.equal(stack(L,'ring'),6);
  near(ts[4],ps[3]*2.00/1.75,'Perfect Pitch follows the louder ring'); near(thps,phps,'its mending is pushed as the game pushes it (the louder ring is applied at each tick)'); L.A[0].hots.splice(0,L.A[0].hots.length-1); const z0=L.A[0].hp; secs(1.02); near(L.A[0].hp-z0,phps*2.25/1.75*1.15,'a tick of ring 6 mending');
  const three=X=>{ room(X,[4e5,6e5]); const g=[]; for(let i=0;i<3;i++){ X.A[1].hp=6e5; g.push(gain(X.A[1],()=>V.cast(X.v,'green'))); } return g; };
  const r=plain({foes:1,allies:2},three), Q=lab(H,S(['lh_5_3','lh_6_3']),{foes:1,allies:2}), q=three(Q);
  near(q[0],r[0],'Steady Choir: ring 1'); near(q[1],r[1],'ring 2'); near(q[2],r[1],'never louder than its 2nd ring'); assert.equal(Q.v._crescStk,2);
  Q.A.forEach(a=>{ a.hots.length=0; }); V.cast(Q.v,'green'); assert.equal(Q.A[0].hots[0].remaining,8,'its mending lasts 5 + 3 s'); const hps=Q.A[0].hots[0].hps;
  const t0=Q.A[0].hp, t1=Q.A[1].hp; secs(1.02); near(Q.A[0].hp-t0,hps*1.12,'Even Breath: 4% x 3 more on an ally below 50%'); near(Q.A[1].hp-t1,hps,'not above');
});

test('Vireo / Crescendo riders: Rapt Silence, Clean Tone, Rising Applause',()=>{
  const L=lab(H,S(['lh_1_1','lh_9_1']),{foes:1,allies:2}), {v,A,F}=L; A.forEach(a=>{ a.maxHp=1e5; a.hp=5e4; a.glyphDR=0; }); V.cast(v,'green'); A.forEach(a=>{ a.hp=5e4; a.hots.length=0; });
  V.hit(F[0],A[0],60000); A[0].hp=5e4; let g0=gain(A[0],()=>{}), x0=A[0].hp, x1=A[1].hp; V.cast(v,'green'); near((A[0].hp-x0)/(A[1].hp-x1),2,'Rapt Silence: a hit of 15%+ of their max HP doubles her next heal on them',1e-9); assert.equal(g0,0);
  A.forEach(a=>{ a.hp=5e4; a.hots.length=0; }); x0=A[0].hp; x1=A[1].hp; V.cast(v,'green'); near((A[0].hp-x0)/(A[1].hp-x1),1,'only the next one',1e-9);
  A[0].hp=5e4; V.hit(F[0],A[0],60000); A.forEach(a=>{ a.hp=5e4; a.hots.length=0; }); x0=A[0].hp; x1=A[1].hp; V.cast(v,'green'); near((A[0].hp-x0)/(A[1].hp-x1),1,'once every 6 s per ally',1e-9);
  const C=lab(H,[['lh_10_3',1]],{foes:1,allies:3}); C.A.forEach((a,i)=>{ a.maxHp=1e6; a.hp=[3e5,4e5,5e5][i]; a.stunned=[1e6,1e6,0][i]; }); C.A[2].fearT=2; V.cast(C.v,'green');
  assert.equal(C.A[0].stunned,0,'Clean Tone: the lowest-HP ally under a control is freed'); assert.ok(C.A[1].stunned>0,'1 ally per rank'); assert.ok(C.A[2].fearT>0,'(A2 has more HP)');
  const G=lab(H,S(['lh_1_1','lh_12_1']),{foes:1,allies:1}); room(G); V.cast(G.v,'green'); assert.equal(G.A[0].energy,0,'not Listening when the first heal landed');
  secs(1.05); assert.equal(G.A[0].energy,2,'Rising Applause: a heal on a Listening ally gives 1 x 2 energy'); secs(1.0); assert.equal(G.A[0].energy,2,'once every 3 s per ally'); secs(2.05); assert.equal(G.A[0].energy,4);
});

test('Vireo / Standing Ovation (SIGNATURE)',()=>{
  const L=lab(H,S(['lh_1_1','lh_4_4','lh_13_2']),{foes:1,allies:2}), {v,A,F}=L; room(L); const pw=v.healPowMul; v.pass=null;
  V.cast(v,'green'); assert.ok(L.T.s.w.ovat&&L.T.s.w.ovat.t>5.9,'every ally is Listening: the hall rises for 6 s'); assert.ok(!(A[0].shield>0),'(no Perfect Pitch here: shields come only from the hall)');
  const hps=A[0].hots[0].hps, h0=A[0].hp, s0=A[0].shield||0; secs(1.02); near(A[0].hp-h0,hps*1.4,'her heals are 40% stronger'); near(A[0].shield-s0,hps*1.4,'and every heal also shields for its full amount'); assert.ok(v.shield>0,'her own heals on herself too');
  A[0].maxHp=1e5; A[0].hp=10; A[0].shield=0; V.hit(F[0],A[0],5e7); assert.ok(A[0].alive,'any ally who would die is caught'); near(A[0].hp,1+1e5*0.24*pw,'by Encore (8% x 3)');
  A[0].hp=10; A[0].shield=0; V.hit(F[0],A[0],5e7); assert.ok(A[0].alive,'even when theirs is already spent');
  secs(5.1); assert.ok(!(L.T.s.w.ovat.t>0)); A[0].hp=10; A[0].shield=0; V.hit(F[0],A[0],5e7); assert.ok(A[0].alive,'after the hall: their own Encore, never used in the hall'); A[0].hp=10; A[0].shield=0; V.hit(F[0],A[0],5e7); assert.ok(!A[0].alive,'and then nothing');
  A[1].hots.length=0; V.cast(v,'green'); assert.ok(!(L.T.s.w.ovat.t>0),'cooldown 30 s');
});

test('Vireo / Dissonance: Off Key, Sharp Voice, Quick Bow, Grating, Ringing Ears, Cacophony, Projection, Afterring',()=>{
  const L=lab(H,S(['ds_1_1','ds_1_3','ds_1_4','ds_2_1','ds_5_1','ds_9_2']),{foes:3,allies:1,big:true}), {v,A,F}=L; room(L); const ap0=v.apow, ai=F[2].atkInterval;
  const m1=plainHit(L,()=>lost(F[1],()=>V.hit(v,F[1],1000,{kind:'magic'}))), p1=plainHit(L,()=>lost(F[1],()=>V.hit(A[0],F[1],1000)));
  V.cast(v,'green'); assert.equal(dis(L,F[0]),1,'Off Key: her heal on an ally gives the enemy nearest that ally 1 Dissonance'); assert.equal(dis(L,F[1])+dis(L,F[2]),0,'(her heal on herself does not count)');
  V.cast(v,'ult'); same(F.map(f=>dis(L,f)),[2,1,1],'Grand Symphony: 1 to every enemy it hits');
  near(lost(F[1],()=>V.hit(v,F[1],1000,{kind:'magic'})),m1*1.05*1.10,'each stack: 1% x 5 more magic damage taken; Sharp Voice 2% x 5 more from her'); near(lost(F[1],()=>V.hit(A[0],F[1],1000)),p1,'a physical hit: no change');
  secs(1.02); assert.equal(dis(L,F[0]),3,'each tick of her mending is a heal too (each enemy at most 1 a second)');
  V.hit(v,F[2],10,{auto:true}); assert.equal(dis(L,F[2]),2,'Quick Bow: her basic attack adds 1'); V.hit(v,F[2],10,{auto:true}); assert.equal(dis(L,F[2]),2,'at most once every 5 - 1 x 3 s'); secs(2.05); V.hit(v,F[2],10,{auto:true}); assert.equal(dis(L,F[2]),3);
  V.step(1); near(F[2].atkInterval,ai/0.95,'Ringing Ears: at 3 Dissonance 1% x 5 slower attacks'); const n=F.reduce((s,f)=>s+dis(L,f),0); near(v.apow,ap0*(1+0.01*n),'Cacophony: 0.2% x 5 ability power per stack on the field');
  secs(6.9); assert.equal(dis(L,F[2]),3,'Grating: it lasts 4 + 1 x 3 s'); secs(0.2); assert.equal(dis(L,F[2]),0,'then it is gone at once'); V.step(1); near(F[2].atkInterval,ai,'and so is Ringing Ears');
  /* Afterring, read through the engine itself: Cacophony's ability power counts the stacks as the runtime sees them */
  const W=lab(H,S(['ds_1_1','ds_11_1','ds_9_2']),{foes:1,allies:1}), wap=W.v.apow, seen=()=>{ V.step(1); return Math.round((W.v.apow/wap-1)/0.01); }; for(let i=0;i<3;i++) V.cast(W.v,'ult'); assert.equal(seen(),4,'3 hits and 1 from its heal on the ally (once a second)');
  secs(4.05); assert.equal(seen(),3,'Afterring: one stack at a time'); secs(2.85); assert.equal(seen(),3,'0.6 s x 5 apart'); secs(0.2); assert.equal(seen(),2); secs(6.05); assert.equal(seen(),0);
  const pj=on=>{ const Q=lab(H,S(on?['ds_1_1','ds_8_3']:['ds_1_1']),{foes:3,allies:1,seed:5}); room(Q); V.cast(Q.v,'green'); let got=0; for(let i=0;i<4;i++){ secs(1.02); got=Math.max(got,dis(Q,Q.F[1])); } return got; };
  assert.equal(pj(false),0,'without Projection the next-nearest enemy gets nothing'); const a=pj(true); assert.ok(a>0&&a<5,'Projection: 10% x 5 a heal, the next-nearest enemy to that ally gains 1 too: '+a); assert.equal(pj(true),a,'the same seed, the same rolls');
});

test('Vireo / Broken Chord: Broken Chord, Shrapnel Chord, Composer\'s Spite, Crack the Glass, Resolution, Feedback, Splitting Chord, Chain Reaction',()=>{
  const ids=['ds_1_1','ds_3_1','ds_4_1','ds_12_1','ds_10_1','ds_n1','ds_6_1','ds_9_1'];
  const L=lab(H,S(ids),{foes:6,allies:1}), {v,A,F}=L; room(L); L.put(F[5],30,30); const ap=v.apow;
  F[1].shield=1000; F[1].shieldT=99; setDis(L,F[0],4); const h=F.map(f=>f.hp), a0=A[0].hp; v.energy=0; V.cast(v,'green');
  const blast=ap*0.60*1.10; near(h[0]-F[0].hp,blast,'Broken Chord at 5: 20% x 3 of her ability power, Composer\'s Spite 5% x 2 more'); near(h[4]-F[4].hp,blast,'it and every enemy within 2 m: F4 (2.06 m)...');
  near(h[3]-F[3].hp,blast,'Shrapnel Chord: 2 + 0.3 x 5 m reaches F3 (3.48 m)'); assert.equal(F[2].hp,h[2],'F2 (6.98 m) is outside'); near(F[1].shield,(1000-blast*1.15)*0.70,'Crack the Glass: 5% x 3 more on a shielded enemy, then 10% x 3 of its shield stripped'); near(h[1]-F[1].hp,0,'(the shield took it all)');
  near(v.energy,5,'Feedback: 1 x 5 energy'); same([0,1,3,4].map(i=>dis(L,F[i])),[2,2,2,2],'Splitting Chord: 2 Dissonance on every enemy it hit (the shattered one too)');
  const pg=plain({foes:1,allies:2},X=>{ room(X,[5e5,4e5]); return gain(X.A[1],()=>V.cast(X.v,'green')); });
  const R=lab(H,S(['ds_1_1','ds_3_1','ds_n1']),{foes:1,allies:2}); room(R,[5e5,4e5]); setDis(R,R.F[0],4); const rg=gain(R.A[1],()=>V.cast(R.v,'green')); near(rg-pg,R.v.apow*0.30,'Resolution: the ally with the lowest HP heals 6% x 5 of her ability power');
  /* Chain Reaction: a blast that pushes an enemy to 5 sets off its chord too (1 per rank); without it, no chain */
  const chain=on=>{ const C=lab(H,S(on?ids.concat(['ds_8_1']):ids),{foes:6,allies:1}); room(C); C.put(C.F[5],30,30); setDis(C,C.F[0],4); setDis(C,C.F[1],3); const h2=C.F[2].hp; V.cast(C.v,'green'); return [h2-C.F[2].hp,dis(C,C.F[1])]; };
  const off=chain(false), onn=chain(true); assert.equal(off[0],0,'without Chain Reaction F1 reaches 5 and waits'); assert.equal(off[1],5); assert.ok(onn[0]>0,'with it F1\'s own chord goes off and reaches F2'); assert.equal(onn[1],2,'and F1 is shattered (then gets 2 from its own Splitting Chord)');
});

test('Vireo / Biting Refrain, Wound Song, Cutting Voice, Harsh Timbre',()=>{
  const P=lab(H,null,{foes:3,allies:1}); room(P); const raw=gain(P.A[0],()=>V.cast(P.v,'green'))/(P.v.healPowMul||1);
  const L=lab(H,S(['ds_1_1','ds_4_2','ds_10_3']),{foes:3,allies:1}), {F}=L; room(L); setDis(L,F[1],3); setDis(L,F[2],1); const h=F.map(f=>f.hp); V.cast(L.v,'green');
  near(h[1]-F[1].hp,raw*0.30*1.15,'Biting Refrain: 10% x 3 of the ring\'s heal to the enemy with the most Dissonance; Harsh Timbre 3% x 5 more'); assert.equal(F[2].hp,h[2]); assert.equal(F[0].hp,h[0]);
  const W=lab(H,S(['ds_1_1','ds_4_2','ds_5_2','ds_6_2','ds_10_3']),{foes:3,allies:1}); room(W); setDis(W,W.F[1],3); setDis(W,W.F[2],4); const w=W.F.map(f=>f.hp); V.cast(W.v,'green');
  near(w[1]-W.F[1].hp,raw*0.30*1.15*1.15,'Wound Song: every enemy with 3 or more, Cutting Voice 5% x 3 more'); near(w[2]-W.F[2].hp,raw*0.30*1.15*1.15,''); assert.equal(W.F[0].hp,w[0],'(1 Dissonance from Off Key: not enough)');
});

test('Vireo / Sour Note: Sour Note, Flat Ear, Long Silence, Tin Ear, Discord Ward, Tone Deaf, Off-Beat Sting, Sour Finale',()=>{
  const L=lab(H,S(['ds_1_1','ds_3_4','ds_4_4','ds_8_4','ds_5_4','ds_11_4','ds_10_4','ds_7_4','ds_12_4']),{foes:3,allies:1,big:true}), {v,A,F}=L; F[1].dmg*=2; F[2].dmg*=1.5; F.forEach(f=>f.level=1);
  const bA=plainHit(L,()=>lost(A[0],()=>V.hit(F[1],A[0],1000))), bV=plainHit(L,()=>lost(v,()=>V.hit(F[1],v,1000))), bOut=plainHit(L,()=>lost(F[1],()=>V.hit(A[0],F[1],1000)));
  secs(5.9); assert.ok(!mark(L,F[1],'sour')); secs(0.15); assert.ok(mark(L,F[1],'sour'),'Sour Note: after 6 s the enemy with the highest attack'); near(markUntil(L,F[1],'sour')-V.now(),3+1.5,'Flat Ear: 3 + 0.5 x 3 s',2e-2);
  assert.ok(F[1].silencedT>0.5&&F[1].silencedT<=0.6,'Long Silence: silenced 0.3 s x 2: '+F[1].silencedT);
  near(lost(A[0],()=>V.hit(F[1],A[0],1000)),bA*0.91,'it deals 3% x 3 less'); near(lost(v,()=>V.hit(F[1],v,1000)),bV*0.91*0.925,'Discord Ward: to her 1.5% x 5 less on top');
  near(lost(F[1],()=>V.hit(A[0],F[1],1000)),bOut*1.10,'Tin Ear: it takes 2% x 5 more from her team');
  F[1].hp-=5000; const g=gain(F[1],()=>V.heal(F[1],1000)); near(g,850,'Tone Deaf: it receives 5% x 3 less healing');
  const h2=F[2].hp, h1=F[1].hp; V.cast(v,'ult'); near((h1-F[1].hp)-(h2-F[2].hp)*1.10,v.apow*0.15,'Off-Beat Sting: each Dissonance that lands on it stings for 3% x 5 of her ability power',1e-6);
  F[1].stunned=1e6; V.dmg(F[1],2e9); assert.ok(!F[1].alive); assert.ok(mark(L,F[2],'sour'),'Sour Finale: it jumps to the next-highest attack'); near(markUntil(L,F[2],'sour')-V.now(),4.5+3,'with 1 s x 3 more'); assert.ok(F[2].silencedT>0.5,'and lands again');
});

test('Vireo / Grand Symphony: Loud Finale, Cold Stage, Ruinous Swell, Clarity, Bowing Arm, Harsh Voice; Fortissimo; Thin Voice',()=>{
  const prep=X=>{ room(X); V.cast(X.v,'green'); V.cast(X.v,'green'); X.F[1].hp=X.F[1].maxHp*0.4; X.A[0].hp=5e5; };
  const [pd0,pd1,pha]=plain({foes:2,allies:1},X=>{ prep(X); X.F.forEach(f=>{ f.mrRating*=0.91; }); const h=X.F.map(f=>f.hp), a=X.A[0].hp; V.cast(X.v,'ult'); return [h[0]-X.F[0].hp,h[1]-X.F[1].hp,X.A[0].hp-a]; });
  const L=lab(H,S(['ds_2_2','ds_9_3','ds_12_2','ds_2_3','li_10_3','ds_6_4']),{foes:2,allies:1}); prep(L); const lh=L.F.map(f=>f.hp), la=L.A[0].hp; V.cast(L.v,'ult');
  const k=1.20*(1+0.03*5*2)*1.10*1.08; near(lh[0]-L.F[0].hp,pd0*k,'Loud Finale 4% x 5, Ruinous Swell 3% x 5 per ring (2), Bowing Arm 2% x 5, Harsh Voice 4% x 2; Clarity ignores 3% x 3 magic resist',1e-6);
  near(lh[1]-L.F[1].hp,pd1*k*1.15,'Cold Stage: 3% x 5 more below 50% HP',1e-6); near(L.A[0].hp-la,pha*1.10*0.92,'its heal: Bowing Arm 2% x 5 more, Harsh Voice 4% x 2 less',1e-6);
  const F2=lab(H,S(['ds_1_1','ds_11_2']),{foes:2}); V.cast(F2.v,'ult'); assert.equal(dis(F2,F2.F[0]),2,'Fortissimo: 2 Dissonance to every enemy it hits'); V.cast(F2.v,'ult'); V.cast(F2.v,'ult'); assert.equal(dis(F2,F2.F[0]),5,'never more than 5');
  const G=lab(H,S(['ds_12_3']),{foes:1,cold:true}), hp0=G.v.maxHp, ap0=G.v.apow; V.step(1); near(G.v.maxHp,hp0*0.95,'Thin Voice: 1% x 5 less max HP'); near(G.v.apow,ap0*1.10,'and 2% x 5 more ability power');
});

test('Vireo / The Whole Music (SIGNATURE)',()=>{
  const L=lab(H,S(['ds_1_1','ds_3_1','ds_13_2']),{foes:3,allies:1}), {v,F}=L; F[2]._raidBoss=true; const h=F.map(f=>f.hp);
  V.cast(v,'ult'); for(const f of F) assert.equal(dis(L,f),0,'every enemy it hits is filled to 5 and its Broken Chord shatters at once'); assert.ok(F.every((f,i)=>f.hp<h[i]),'');
  F[1].hp=F[1].maxHp*0.11; F[2].hp=F[2].maxHp*0.11; const b2=F[2].hp; V.step(1); assert.ok(!F[1].alive,'below 12% while it plays: falls silent and dies');
  assert.ok(F[2].alive,'a boss does not die'); near(b2-F[2].hp,F[2].maxHp*0.06,'it takes 6% of its max HP'); const c2=F[2].hp; V.step(3); near(F[2].hp,c2,'once per Grand Symphony');
  secs(5); F[0].hp=F[0].maxHp*0.10; V.step(2); assert.ok(F[0].alive,'after 5 s, no more');
  const N=lab(H,S(['ds_1_1','ds_13_2']),{foes:1}); V.cast(N.v,'ult'); assert.equal(dis(N,N.F[0]),5,'without Broken Chord the stacks just stay full');
});

test('Vireo / Tempo: Keep Time, Accent, Quick Tempo, Metronome, Cue, Conductor\'s Eye, Tempo Giusto, In the Pocket, March Time, Drumline, Accelerando, Rallentando',()=>{
  const ids=['li_1_1','li_4_1','li_7_1','li_2_1','li_3_1','li_10_1','li_12_1','li_11_1','li_5_3','li_6_3','li_9_1','li_8_1'];
  const L=lab(H,S(ids),{foes:3,allies:2,big:true,cold:true}), {v,A,F}=L; A[1].energy=10; V.step(1);
  const bV=plainHit(L,()=>lost(v,()=>V.hit(F[0],v,1000))), bO=plainHit(L,()=>lost(F[0],()=>V.hit(v,F[0],1000,{auto:true}))); const beat=2/1.05, db=4*beat, h=F.map(f=>f.hp); v.energy=0;
  secs(db-0.15); assert.equal(v.energy,0,'no Downbeat yet'); secs(0.2);
  assert.equal(v.energy,3,'Metronome: a Downbeat on the 4th Beat (Quick Tempo: 2 s / 1.05) gives her 1 x 3 energy'); assert.equal(A[0].energy,2,'Tempo Giusto: every ally 1 x 2'); assert.equal(A[1].energy,10+2+6,'Cue: the ally closest to a full ultimate 3 + 1 x 3');
  F.forEach((f,i)=>near(h[i]-f.hp,v.apow*0.30,'March Time + Drumline: the nearest 1 + 1 x 3 enemies are struck for 30% of her ability power'));
  near(lost(v,()=>V.hit(F[0],v,1000)),bV*0.85,'In the Pocket: 3% x 5 less damage for 1 s'); near(lost(F[0],()=>V.hit(v,F[0],1000,{auto:true})),bO*1.30,'Keep Time: her next attack 5% x 5 + Accent 1% x 5 stronger');
  near(lost(F[0],()=>V.hit(v,F[0],1000,{auto:true})),bO,'only the next one'); secs(1.05); near(lost(v,()=>V.hit(F[0],v,1000)),bV,'In the Pocket lasted 1 s');
  assert.equal(stack(L,'accel'),1,'Accelerando: each Downbeat makes the Beat 3% faster'); const t1=V.now(); v.hp=v.maxHp*0.3; const e=v.energy;
  for(let i=0;i<400&&v.energy===e;i++) V.step(1); near(V.now()-t1+1.05+0.05,4*2/(1.05+0.03+0.18),'Rallentando: below 40% HP Beats come 6% x 3 faster',0.03);
  const G=lab(H,S(['li_1_1','li_5_1','li_12_1']),{foes:1,allies:1,big:true}); secs(6.1); assert.equal(G.A[0].energy,2,'Tempo Giusto (Waltz: a Downbeat every 6 s)'); secs(6); assert.equal(G.A[0].energy,2,'once every 8 s'); secs(6); assert.equal(G.A[0].energy,4);
});

test('Vireo / Waltz Time, Three-Step, Second Movement, Practised Hands',()=>{
  const L=lab(H,S(['li_1_1','li_5_1','li_6_1']),{foes:1,big:true}); L.v.blueCd=5; secs(5.9); near(L.v.blueCd,5); secs(0.2); near(L.v.blueCd,4.4,'Waltz Time: the 3rd Beat is the Downbeat; Three-Step takes 0.2 s x 3 off Harmony');
  const [p1,p2]=plain({foes:1,allies:1},X=>{ room(X); const a=gain(X.A[0],()=>V.cast(X.v,'green')); X.A[0].hp=5e5; return [a,gain(X.A[0],()=>V.cast(X.v,'green'))]; });
  const M=lab(H,S(['li_1_1','li_7_2']),{foes:1,allies:1,big:true}); room(M); secs(8.05);
  const m1=gain(M.A[0],()=>V.cast(M.v,'green')); near(m1,p2*1.25,'Second Movement: cast on a Downbeat it rings twice at once (ring 2), with the Downbeat bonus 5% x 5'); assert.equal(M.v._crescStk,2); assert.equal(stack(M,'ring'),2); assert.ok(p1<p2);
  near(FX.cd(M.v,'green',7),6,'and comes back 1 s sooner'); near(FX.cd(M.v,'green',7),7,'only that one');
  const Q=lab(H,S(['li_1_3']),{foes:1}); near(FX.cd(Q.v,'green',7),7/1.05,'Practised Hands: her skills come back 1% x 5 faster'); near(FX.cd(Q.v,'blue',9),9/1.05,'');
});

test('Vireo / Bars: The Unfinished Score, Rehearsed, Sight Reading, Memorised, Long Rehearsal, Memory of the Whole, Last Rehearsal, Overture',()=>{
  const ids=['li_2_2','li_4_2','li_6_2','li_5_2','li_9_2','li_11_2','li_12_2','li_1_1'];
  const ratio=plain({foes:1,allies:1},X=>{ room(X); V.cast(X.v,'blue'); return X.A[0].shield/X.v.apow; });
  const L=lab(H,S(ids),{foes:1,allies:1,big:true,cold:true}), {v,A,F}=L; room(L); const ap0=v.apow, hp0=v.healPowMul; V.step(1); V.step(1);
  assert.equal(stack(L,'bars'),3,'Rehearsed: she starts the fight with 1 x 3 Bars'); near(v.apow,ap0*(1+3*0.025),'0.5% x 5 ability power per Bar'); near(v.healPowMul,hp0*(1+3*0.015),'Memorised: 0.3% x 5 healing power per Bar');
  secs(6.4); assert.equal(stack(L,'bars'),3); secs(0.2); assert.equal(stack(L,'bars'),4,'Sight Reading: a Bar every 8 - 0.5 x 3 s');
  V.cast(v,'blue'); near(A[0].shield,ratio*v.apow*(1+0.05*4),'Long Rehearsal: Harmony\'s shield 1% x 5 larger per Bar',1e-6);
  secs(6.5*2+0.1); assert.equal(stack(L,'bars'),6); secs(13); assert.equal(stack(L,'bars'),6,'at most 6');
  V.step(1); const e0=v.energy; v.energy+=8; V.step(1); near(v.energy,e0+8*1.25,'Memory of the Whole: at 6 Bars she gains ultimate energy 25% faster');
  const bO=plainHit(L,()=>lost(F[0],()=>V.hit(v,F[0],1000,{auto:true}))); L.T.s.w.db={t:99,n:1,cdT:0,at:-1,wave:false}; near(lost(F[0],()=>V.hit(v,F[0],1000,{auto:true})),bO*1.25*1.15,'Last Rehearsal: at 6 Bars the Downbeat bonus is 3% x 5 larger');
  const ov=X=>{ room(X); const g=[gain(X.A[0],()=>V.cast(X.v,'green'))]; X.A[0].hp=5e5; g.push(gain(X.A[0],()=>V.cast(X.v,'green'))); V.wave(); V.step(1); X.A[0].shield=0; V.cast(X.v,'blue'); g.push(X.A[0].shield); return g; };
  const q=plain({foes:1,allies:1},ov), o=ov(lab(H,S(['li_9_3']),{foes:1,allies:1}));
  near(o[0],q[0]*1.20,'Overture: her first skill of the wave is 4% x 5 stronger'); near(o[1],q[1],'only the first'); near(o[2],q[2]*1.20,'a new wave: the first skill again (Harmony: a stronger shield)');
});

test('Vireo / Strings: Rib Strings, Spare Strings, Strung Tight, Taut Frame, Frayed Edge, Twang, Retune, Fine Tuning, Snap Back, Poise',()=>{
  const ids=['li_1_4','li_8_4','li_5_4','li_7_4','li_6_4','li_4_4','li_3_4','li_11_4','li_10_4','li_3_3'];
  const L=lab(H,S(ids),{foes:1,cold:true}), {v,F}=L; const ar=v.armorRating, ap=v.apow; V.step(1); v.maxHp=v.hp=1e6; v.glyphDR=0;
  assert.equal(stack(L,'str'),8,'Spare Strings: 6 + 1 x 2 Strings'); near(v.armorRating,ar*1.08,'Taut Frame: 0.2% x 5 armor per String'); near(v.apow,ap,'no snapped String: no Frayed Edge');
  const small=plainHit(L,()=>lost(v,()=>V.hit(F[0],v,1000))), big=plainHit(L,()=>lost(v,()=>V.hit(F[0],v,300000)));
  near(lost(v,()=>V.hit(F[0],v,1000)),small*0.88,'Strung Tight: 0.3% x 5 less damage per whole String'); assert.equal(stack(L,'str'),8,'a small hit snaps nothing');
  const f0=F[0].hp; near(lost(v,()=>V.hit(F[0],v,300000)),big*0.82*(1-0.015*7),'a hit worth more than 10% of her max HP snaps a String and loses 6% x 3 (Strung Tight counts the 7 still whole)'); assert.equal(stack(L,'str'),7);
  near(f0-F[0].hp,ap*0.45,'Twang: the attacker takes 15% x 3 of her ability power'); V.step(1); near(v.apow,ap*1.04,'Frayed Edge: 2% x 2 ability power per snapped String'); near(v.armorRating,ar*1.07,'');
  const h=v.hp; secs(7-0.2); assert.equal(stack(L,'str'),7); secs(0.3); assert.equal(stack(L,'str'),8,'Retune: back after 10 - 0.6 x 5 s'); near(v.hp-h,1e6*0.05,'Fine Tuning: a retuned String heals her 1% x 5 of her max HP');
  v.stunned=0; let ok=false; for(let i=0;i<20&&!ok;i++){ v.stunned=0; ok=V.cc(F[0],v,'stunned',2); } near(v.stunned,2*V.ccNerf*0.80,'Poise: control on her 4% x 5 shorter');
  const B=lab(H,S(['li_1_4','li_10_4','li_11_4']),{foes:1}), w=B.v; w.maxHp=w.hp=1e6; w.glyphDR=0; const big0=plainHit(B,()=>lost(w,()=>V.hit(B.F[0],w,300000)));
  for(let i=0;i<5;i++){ w.hp=w.maxHp; V.hit(B.F[0],w,300000); } assert.equal(stack(B,'str'),1); w.hp=5e5; V.hit(B.F[0],w,300000); assert.equal(stack(B,'str'),0);
  near(w.hp-5e5,-big0*0.82+1e6*0.18*w.healPowMul,'Snap Back: the last String heals her 6% x 3 of her max HP'); const h3=w.hp; secs(2.9); assert.equal(stack(B,'str'),0); secs(0.2); assert.equal(stack(B,'str'),6,'and every String retunes 3 s later'); near(w.hp-h3,1e6*0.05*6,'(each one: Fine Tuning)');
  const Hs=lab(H,S(['li_1_4','li_12_4']),{foes:1,allies:1}), a=Hs.A[0]; a.maxHp=1e5; a.hp=2e4; a.glyphDR=0; const bh=plainHit(Hs,()=>lost(a,()=>V.hit(Hs.F[0],a,1000))); a.hp=2e4;
  const got=lost(a,()=>V.hit(Hs.F[0],a,1000)); near(got,bh*0.5-1e5*0.06,'Heartstrings: an ally below 25% hit: she snaps a String to halve it, and they heal 2% x 3'); assert.equal(stack(Hs,'str'),5);
  near(lost(a,()=>V.hit(Hs.F[0],a,1000)),bh,'once every 4 s'); a.hp=9e4; secs(4.05); near(lost(a,()=>V.hit(Hs.F[0],a,1000)),bh,'not above 25%');
});

test('Vireo / The Final Note (SIGNATURE): its Grand Symphony, the 6 s of Downbeats, the Strings, the Bars',()=>{
  const [hd,hh]=plain({foes:1,allies:1,big:true},X=>{ room(X); const f=X.F[0].hp, a=X.A[0].hp; V.cast(X.v,'ult'); return [(f-X.F[0].hp)/X.v.apow,(X.A[0].hp-a)/X.v.apow]; });
  const L=lab(H,S(['li_1_1','li_1_4','li_2_2','li_13_2']),{foes:1,allies:1,big:true,cold:true}); room(L); V.step(1); const {v,A,F}=L;
  setStack(L,'bars',6); V.step(1); const ap6=v.apow;
  const lh=F[0].hp, la=A[0].hp; V.cast(v,'ult'); near((lh-F[0].hp)/ap6,hd*2.5,'at 6 Bars her next Grand Symphony deals 150% more',1e-6); near((A[0].hp-la)/ap6,hh*2.5,'and heals 150% more',1e-6);
  assert.equal(stack(L,'str'),0,'all her Strings snap at once'); assert.equal(stack(L,'bars'),3,'she forgets 3 Bars');
  let n=0; for(let i=0;i<Math.round(6/V.STEP);i++){ const w=L.T.s.w.db; if(w&&w.t>0){ n++; w.t=0; } V.step(1); } assert.equal(n,3,'every Beat for 6 s is a Downbeat (3 Beats)');
  secs(4.1); assert.equal(stack(L,'str'),6,'the Strings retune as usual');
  const e=v.energy; V.cast(v,'ult'); const lh2=F[0].hp; assert.ok(e>=0&&lh2>0&&!(L.T.s.w.fnote&&L.T.s.w.fnote.t>0),'below 6 Bars a Grand Symphony is a plain one');
});

test('Vireo: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['lh_1_1','ds_1_1','li_1_1','li_1_4','li_2_2','lh_2_2','ds_3_1']), TEAM=['vael','sylthaine','vireo','vex','gruel'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  let listen=false, dsn=0, beats=false, bars=0, held=false; for(let i=0;i<2400&&!V.ended()&&s.alive;i++){ V.step(1); const T0=s._tal.s;
    listen=listen||U.some(u=>u!==s&&u.team==='ally'&&mark({v:s},u,'listen')); dsn=Math.max(dsn,...U.filter(u=>u.team==='enemy').map(u=>{ const m=u._talM&&u._talM[s.uid]&&u._talM[s.uid]['#dis']; return m&&m.until>V.now()?m.v:0; }));
    beats=beats||!!(T0.w.db); bars=Math.max(bars,T0.k.bars?T0.k.bars.n:0); held=held||U.some(u=>(u.hots||[]).some(h=>h._talK==='held')); }
  assert.ok(listen,'a real Crescendo made her allies Listening'); assert.ok(dsn>=1,'real heals put Dissonance on enemies: '+dsn); assert.ok(beats,'the Downbeat came'); assert.ok(bars>=1,'she learned a Bar'); assert.ok(held,'a real mending ended into a Held Note');
  determinism(H,TEAM);
});
