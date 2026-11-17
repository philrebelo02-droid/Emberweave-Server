'use strict';
/* Pellucid's talents as data on the mechanics layer (talents-mech/pellucid.js), group by group on the still field (tests/talents-lab.js), then whole fights,
   the no-talent identity of the page sites his talents added (the 18 displacement tests that call 'unmoved', each slam of Worldbreaker Fists and each of its
   shockwave hits), and Phil's 95% damage-reduction ceiling. Each group: the effect happens, has the right size, at the right time, and stops when it should.
   Plain numbers are measured with his talents switched off for one hit (plainHit). lab() replaces the whole field: a second lab replaces the first.
   Places (metres from Pellucid, centre to centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0) F3 (0,6) F4 (5.5,6); A0 (0,-5.5) A1 (0,-11). His body is 2.01 m, a Vael's 2.01 m,
   so F0 stands 0.48 m from him body to body and F1 5.98 m. The lab's skill level is 10.
   Meteor Knuckle lands where its target stood at the launch (the lab casts it as landed on its target) and strikes every enemy whose centre is within 2.6 m of
   that spot. In real fights today it can land at an old ultimate's aim (release v1391 fixes that); every test below places its enemies on its target's spot,
   which the skill reaches before and after that fix.
   Run: node --test tests/talents-mech-pellucid.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,mark,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='pellucid', S=ids=>full(H,ids);
const TMP=[]; test.after(()=>{ for(const d of TMP) try{ fs.rmSync(d,{recursive:true,force:true}); }catch(e){} });
const VMX=s=>vm.runInContext(s,NOW.ctx);
test.afterEach(()=>{ FX.define(H,null); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{},{n,t:99,idle:0}); };
const setMk=(L,t,name,dur)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o[name]={t0:V.now(),until:dur==null?null:V.now()+dur,v:0}; };
const left=(L,t,name)=>{ const m=t._talM&&t._talM[L.v.uid]&&t._talM[L.v.uid][name]; return m&&m.until!=null?Math.max(0,m.until-V.now()):(m?Infinity:0); };
const win=(L,name)=>{ const w=L.T.s.w[name]; return w&&w.t>0?w.t:0; };
const openWin=(L,name,d)=>{ L.T.s.w[name]={t:d||9,n:1,cdT:0,at:-1,wave:false}; };
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const pe=L=>L.T.s.pe;
const rel=(a,b,msg,tol)=>assert.ok(Math.abs(a/b-1)<=(tol||1e-6),(msg||'')+': '+a+' vs '+b);
const free=x=>{ x.stunned=0; x.silencedT=0; x.speed=0; x.level=1; x.atkCd=1e9; x.greenCd=1e9; x.blueCd=1e9; x.energy=0; };   // no longer held, standing still, his controls always land
const ATK=L=>L.v.dmg;                                                                                    // his attack in the lab (no buff, Blood Rage 1 before 22 s)
const myDots=(L,t,tag)=>(t.dots||[]).filter(d=>d._talO===L.v.uid&&(tag==null||d._talK===tag)&&d.remaining>0);
const dotTotal=d=>d.dps*(d.remaining-1+(d._talF!=null?d._talF:1));
/* the lab: Pellucid with 1e5 HP (so a hit's share of his max HP is easy to set), his foes held */
function pl(list,o){ o=o||{}; const L=lab(H,list,Object.assign({foes:3},o,{cold:true,big:true})); L.v.maxHp=L.v.hp=o.hp||1e5; L.v.energy=0; L.v.wardenStk=5;   /* his molten layers at their top: a ratio's two hits never see different layers */ if(o.pre) o.pre(L); V.step(1); L.v.hp=L.v.maxHp; return L; }
const hitOn=(L,amt,o)=>{ o=o||{}; const v=L.v, src=o.src||L.F[0]; const r=lost(v,()=>V.hit(src,v,amt,Object.assign({kind:'true'},o))); if(!o.keep){ v.hp=v.maxHp; v.shield=o.shield==null?0:v.shield; } v.energy=0; return r; };
const inRatio=(L,o)=>{ const a=hitOn(L,100,o); return a/plainHit(L,()=>hitOn(L,100,o)); };
const tHit=(L,t,amt,o)=>lost(t,()=>V.hit(L.v,t,amt||1000,Object.assign({kind:'true'},o||{})));
const ratio=(L,t,o)=>tHit(L,t,1000,o)/plainHit(L,()=>tHit(L,t,1000,o));
function skillRatio(L,t,skill,o){ const s=L.T.s, keep=s.cur; s.cur=skill; let a; try{ a=tHit(L,t,1000,o); } finally{ s.cur=keep; } s.cur=skill; let b; try{ b=plainHit(L,()=>tHit(L,t,1000,o)); } finally{ s.cur=keep; } return a/b; }
const allyRatio=(L,a,src,o)=>{ const f=()=>lost(a,()=>V.hit(src||L.F[0],a,1000,Object.assign({kind:'true'},o||{}))); return f()/plainHit(L,f); };
const castOn=(L,slot,t)=>V.cast(L.v,slot,t);
/* an enemy unit uses one of the game's own displacement skills on him (the case code itself, through doEffect) */
const enemyCast=(by,tgt,type,o)=>VMX('(function(u,t,type,o){ u.target=t; u._castSlot="green"; u._castLv=100; u._castSM=1; try{ doEffect(u,type,o); } finally{ u._castSlot=null; u._castLv=0; } })')(by,tgt,type,o);
const M_=()=>V.METER;

test('Pellucid: every talent is accounted for - 10 plain stats, 113 with rows, none waiting',()=>{
  accounting(H,[123,10,113,0,0]);
  const M=FXN.mech(H); for(const id of ['gc_1_1','rk_1_1','fm_1_1','gc_13_2','rk_13_3','fm_13_2','gc_7_3']) assert.ok(M.talents[id],id);
  for(const id of ['fm_1_3','fm_3_3','fm_7_3','fm_n1','gc_2_3','gc_3_3','gc_8_3','rk_1_2','rk_3_2','rk_n1']) assert.ok(FXN.has(H,id),id+' is a plain stat');
  near(FXN.totals(H,[['fm_7_3',5]]).critDmg,0.10,'Heavy Impact: 2% a rank, 10% in all'); near(FXN.totals(H,[['fm_3_3',5]]).crit,0.05,'Magma Fist: the only crit chance, 5%');
  assert.equal(T.talent(H,'gc_9_3').name,'Warm Layers'); assert.equal(T.talent(H,'fm_10_4').name,'Settling Ground'); assert.equal(T.talent(H,'fm_11_2').name,'Open Hearth');
});

test('Pellucid: his real kit, as the talents read it - Meteor Knuckle, Infernal Clinch, Worldbreaker Fists, Unmovable Mass',()=>{
  let L=pl(null,{foes:4}); let [F0,F1,F2,F3]=L.F; for(const f of L.F) free(f); at(L,F3,4.5,2.2);
  const h=L.F.map(f=>f.hp); castOn(L,'green',F0);
  assert.ok(F0.hp<h[0]&&F3.hp<h[3],'Meteor Knuckle strikes its target and an enemy 2.2 m from it'); assert.equal(F1.hp,h[1]); near(F0.stunned,1.4,'a 1.4 s area stun'); near(F3.stunned,1.4);
  L=pl(null,{foes:3}); [F0,F1,F2]=L.F; for(const f of L.F) free(f); F2.dmg=1e4; const h2=F2.hp; castOn(L,'blue',F0);
  assert.ok(F2.hp<h2,'Infernal Clinch grabs the strongest enemy, 15.5 m away'); near(F2.stunned,2.45,'a 2.45 s stun'); near(F2._atkDnPct,0.35); assert.equal(F0.stunned,0);
  L=pl(null,{foes:3}); [F0]=L.F; free(F0); let mx=0; const h3=F0.hp; castOn(L,'ult',F0); const st=[];
  for(let i=0;i<110;i++){ V.step(1); if(F0.stunned>mx+0.5) st.push(+F0.stunned.toFixed(2)); mx=Math.max(mx,F0.stunned); }
  assert.ok(F0.hp<h3); near(mx,2.8,'the third slam: the 2.8 s ceiling',1e-3); assert.ok(st.length>=2,'two stuns of 1.4 s, then the third: '+st);
  L=pl(null,{foes:2}); const v=L.v; v.wardenStk=0; v._mmHits=0; for(let i=0;i<3;i++) hitOn(L,10); assert.equal(v.wardenStk,1,'every 3rd direct hit: a molten layer'); assert.ok(v.immovable);
  const pm=VMX('(u=>wardenCut(u))')(v); near(pm,0.04*v.passMul,'4% x the passive level a layer');
});

test('Pellucid: the page sites his talents read - each slam, each shockwave hit as that slam\'s, and every refused displacement (Unmoved)',()=>{
  const def={hero:H,casting:true,talents:{gc_1_1:[{on:'pass',do:[{fn:'p'}]},{on:'landPre',do:[{fn:'lp'}]},{on:'unmoved',do:[{fn:'um'}]}]},
    fn:{p(A,T,u,c){ (T.s.ev=T.s.ev||[]).push('pass:'+c.skill); }, lp(A,T,u,c){ (T.s.ev=T.s.ev||[]).push('lp:'+c.skill+':'+T.s.cur); }, um(A,T,u,c){ (T.s.ev=T.s.ev||[]).push('um:'+c.kind+':'+(c.src&&c.src.key)); }}};
  let L=lab(H,[['gc_1_1',1]],{def,foes:3,big:true}); free(L.F[0]); castOn(L,'ult',L.F[0]); secs(2.5);
  const ev=L.T.s.ev||[]; for(const k of [0,1,2]){ assert.ok(ev.indexOf('pass:wbSlam'+k)>=0,'slam '+k); assert.ok(ev.indexOf('lp:wb'+k+':wb'+k)>=0,'its shockwave hit resolves as wb'+k); }
  L=lab(H,[['gc_1_1',1]],{def,foes:3,big:true}); const v=L.v, F0=L.F[0], x0=v.x, y0=v.y;
  enemyCast(F0,v,'pullsilence',{radius:5*M_(),dur:2}); enemyCast(F0,v,'knockstun',{mul:0.1,stun:1,push:1.6*M_()}); enemyCast(F0,v,'tendrilpull',{nearest:true,mul:0.1,dur:1.2,stop:1.2});
  const e2=L.T.s.ev||[]; assert.ok(e2.indexOf('um:pull:vael')>=0&&e2.indexOf('um:push:vael')>=0,'a pull and a push he did not move for: '+e2); assert.equal(v.x,x0); assert.equal(v.y,y0);
  FX.define(H,def); const al=JSON.stringify(NOW.snapFromSpecs([spec('pellucid',100,[['gc_1_1',1]]),spec('vael',100)])), fo=JSON.stringify(NOW.snapFromSpecs([spec('vael',100),spec('vael',100)]));
  const r=JSON.parse(vm.runInContext(RS+'('+al+','+fo+')',NOW.ctx)), c=r[6]; assert.equal(r[1].filter(x=>x.slice(0,3)!=='k4:').length,0,JSON.stringify(r[1])); assert.equal(c.length,18);
  c.forEach((x,i)=>assert.ok(x>(i?c[i-1]:0),'the '+RSN[i]+' he did not move for: the unmoved hook ('+c.join(',')+')'));
});

test('Pellucid / Craze: Hairline (a hit above 5% of his max HP, max 5, the crust breaks at 5, none in the Flow; the leak 1% x 3 a Craze a second within 2 m), Spider Lines, Kiln-Fired',()=>{
  let L=pl(S(['gc_1_1']),{foes:3}); const v=L.v, [F0,F1]=L.F;
  hitOn(L,0.049*v.maxHp); assert.equal(stack(L,'peCraze'),0,'4.9%: none'); hitOn(L,0.051*v.maxHp); assert.equal(stack(L,'peCraze'),1,'5.1%: one');
  for(let i=0;i<3;i++) hitOn(L,0.06*v.maxHp); assert.equal(stack(L,'peCraze'),4); hitOn(L,0.06*v.maxHp); assert.equal(stack(L,'peCraze'),0,'at 5 the crust breaks and the Craze clears'); assert.equal(pe(L).brkN,1);
  setStack(L,'peCraze',3); pe(L).lkA=0; const a=lost(F0,()=>secs(1.04)), b=lost(F1,()=>{});
  rel(a,0.01*3*3*ATK(L),'the leak: 1% x 3 ranks x 3 Craze of his attack, on an enemy 0.5 m from him',1e-3); assert.equal(b,0);
  const c=lost(F1,()=>secs(1.04)); assert.equal(c,0,'not 6 m away');
  L=pl(S(['gc_1_1','gc_2_1']),{foes:2}); hitOn(L,0.019*L.v.maxHp); assert.equal(stack(L,'peCraze'),0,'1.9%: none'); hitOn(L,0.021*L.v.maxHp); assert.equal(stack(L,'peCraze'),1,'Spider Lines: 2.1% crazes');
  L=pl(S(['gc_1_1','gc_1_2']),{foes:2}); openWin(L,'peFlow',3); hitOn(L,0.2*L.v.maxHp); assert.equal(stack(L,'peCraze'),0,'none while the Flow runs');
  L=pl(S(['gc_1_1','gc_6_4']),{foes:2}); assert.equal(stack(L,'peCraze'),4,'Kiln-Fired: 2 a rank at the wave start');
});

test('Pellucid / the Flow: Fire Under Glass (4 s; 4% x 5 of a hit over 2 s on basic attacks and his Green and Blue), Hot Run, Ember Glow, River of Fire, Patient Fire',()=>{
  let L=pl(S(['gc_1_1','gc_1_2','gc_2_2','gc_10_2','gc_11_2']),{foes:3}); const v=L.v, F0=L.F[0], d0=v.dmg;
  setStack(L,'peCraze',4); hitOn(L,0.06*v.maxHp); near(win(L,'peFlow'),4+1.5,'the crust breaks: the Flow, 5.5 s (Hot Run)',0.05); assert.equal(stack(L,'peFlows'),1);
  V.step(1); rel(v.dmg/d0,1.05,'Patient Fire: 1% x 5 a Flow');
  V.hit(v,F0,1000,{kind:'true',auto:true}); let D=myDots(L,F0,'peFlowB'); assert.equal(D.length,1,'a basic attack burns'); rel(dotTotal(D[0]),0.20*1000,'4% x 5 of the hit'); assert.equal(D[0].remaining,3); near(D[0]._talF,0.9,'over 2.9 s (Ember Glow 0.3 x 3)',1e-6);
  F0.dots.length=0; V.hit(v,F0,1000,{kind:'true'}); assert.equal(myDots(L,F0,'peFlowB').length,0,'not a hit of no skill');
  const s=L.T.s; s.cur='aoeStun'; V.hit(v,F0,1000,{kind:'true'}); s.cur=null; assert.equal(myDots(L,F0,'peFlowB').length,1,'Meteor Knuckle burns');
  F0.dots.length=0; s.cur='wb1'; V.hit(v,F0,1000,{kind:'true'}); s.cur=null; assert.equal(myDots(L,F0,'peFlowB').length,0,'a shockwave does not');
  L=pl(S(['gc_9_2']),{foes:2}); openWin(L,'peFlow',3); L.T.s.cur='wb0'; V.hit(L.v,L.F[0],1000,{kind:'true'}); L.T.s.cur=null; assert.equal(myDots(L,L.F[0],'peFlowB').length,1,'River of Fire: a shockwave does');
  rel(dotTotal(myDots(L,L.F[0],'peFlowB')[0]),40,'without Fire Under Glass learned its burn is one rank\'s worth (4%)');
  L=pl(S(['gc_1_1','gc_1_2']),{foes:2}); setStack(L,'peCraze',4); hitOn(L,0.06*L.v.maxHp); secs(3.9); assert.ok(win(L,'peFlow')>0); secs(0.2); assert.equal(win(L,'peFlow'),0,'4 s');
  V.hit(L.v,L.F[0],1000,{kind:'true',auto:true}); assert.equal(myDots(L,L.F[0],'peFlowB').length,0,'no burn after it');
});

test('Pellucid / during the Flow: Lava Fist, Clear Strike (critical damage), Old Lava, Lava Tide (1.2% a second at most), What Lies Beneath',()=>{
  let L=pl(S(['gc_1_2','gc_4_2','gc_7_3','gc_12_1','gc_8_2','gc_12_2']),{foes:2}); const v=L.v, F0=L.F[0], ai=v.atkInterval;
  near(skillRatio(L,F0,'aoeStun'),1,'Lava Fist: not outside the Flow'); openWin(L,'peFlow',20); V.step(1);
  rel(skillRatio(L,F0,'aoeStun'),1.15,'Lava Fist: 5% x 3'); rel(ratio(L,F0,{crit:true}),1.10,'Clear Strike: critical hits 2% x 5 more'); rel(ratio(L,F0),1,'(not a normal hit)');
  rel(v.atkInterval/ai,0.91,'Old Lava: 3% x 3 shorter'); rel(inRatio(L),1-0.075,'What Lies Beneath: 1.5% x 5');
  v.hp=0.5*v.maxHp; pe(L).tdA=0; const h=v.hp; secs(2.02); rel((v.hp-h)/v.maxHp,0.024,'Lava Tide: 0.24% x 5 = 1.2% a second',1e-3);
  L.T.s.w.peFlow.t=0; V.step(2); rel(v.atkInterval/ai,1,'back after it');
});

test('Pellucid / Reglaze: when the Flow ends a shield of 1% x 5 (+ Second Skin 1% x 5, Clear as Glass 2% x 3 stronger) for 4 s + 5 (Thick Glaze); Clear as Glass cleanses; Cooling Crust; Annealing',()=>{
  let L=pl(S(['gc_1_2','gc_1_4','gc_9_4','gc_3_4','gc_5_4','gc_7_4']),{foes:2}); const v=L.v; v.shield=0; openWin(L,'peFlow',0.03); v.silencedT=0;
  V.step(3); rel(v.shield,0.10*1.06*v.maxHp,'10.6% of his max HP'); near(win(L,'peGlaze'),9,'9 s',0.1); assert.ok(!(v.stunned>0),'Clear as Glass cleansed one control (the lab\'s hold)'); v.stunned=1e6;
  rel(ratio(L,L.F[0]),1.15,'Cooling Crust: 3% x 5 while it holds'); v.shield=0; rel(ratio(L,L.F[0]),1,'not with the shield gone');
  L=pl(S(['gc_1_1','gc_1_2','gc_1_4']),{foes:2}); L.v.shield=0; openWin(L,'peFlow',0.03); V.step(3); rel(L.v.shield,0.05*L.v.maxHp,'Reglaze alone: 5%');
  L=pl(S(['gc_1_2','gc_9_4']),{foes:2}); L.v.shield=0; openWin(L,'peFlow',0.03); V.step(3); rel(L.v.shield,0.06*L.v.maxHp,'Second Skin without Reglaze: one rank of Reglaze (1%) + 5%');
  L=pl(S(['gc_1_1','gc_1_2','gc_1_4','gc_12_4']),{foes:2}); L.v.shield=0; openWin(L,'peFlow',0.03); V.step(3); assert.ok(win(L,'peGlaze')>0);
  hitOn(L,0.04*L.v.maxHp,{shield:true}); assert.ok(win(L,'peGlaze')>0,'a hit it holds'); assert.equal(stack(L,'peCraze'),0);
  hitOn(L,0.04*L.v.maxHp,{shield:true}); assert.equal(win(L,'peGlaze'),0,'it broke'); assert.equal(stack(L,'peCraze'),2,'Annealing: 1 Craze a rank');
});

test('Pellucid / the crust breaking: Hold It Back (25%, 3 s + 0.5 x 3), Glass Splinters (60% on the 3 nearest), Flood the Valley (30% over 3 s within 3 m)',()=>{
  let L=pl(S(['gc_1_1','gc_5_3','gc_6_3','gc_11_1']),{foes:4}); const v=L.v, [F0,F1,F2,F3]=L.F; const h=L.F.map(f=>f.hp);
  setStack(L,'peCraze',4); hitOn(L,0.06*v.maxHp); near(win(L,'peHold'),4.5,'4.5 s',0.05); rel(inRatio(L),0.75,'25% less');
  for(const f of [F0,F1,F3]) rel(h[L.F.indexOf(f)]-f.hp,0.6*ATK(L),'a splinter: 60% of his attack'); assert.equal(F2.hp,h[2],'the 4th nearest: none');
  secs(4.6); rel(inRatio(L),1,'over');
  L=pl(S(['gc_1_1','gc_5_2']),{foes:3}); setStack(L,'peCraze',4); hitOn(L,0.06*L.v.maxHp);
  const D=myDots(L,L.F[0],'peFld'); assert.equal(D.length,1); rel(dotTotal(D[0]),0.30*ATK(L),'30% of his attack'); assert.equal(D[0].remaining,3); assert.equal(myDots(L,L.F[1],'peFld').length,0,'not 6 m away');
});

test('Pellucid / Craze riders: Running Heat, Safety Glass (20% at 4+), Heat Shimmer (him and his allies), Fault Lines, Brittle Edge',()=>{
  let L=pl(S(['gc_1_1','gc_4_1','gc_3_1','gc_6_1','gc_8_1','gc_10_1']),{foes:3,allies:1}); const v=L.v, [F0,F1]=L.F, A0=L.A[0], d0=v.dmg;
  setStack(L,'peCraze',4); V.step(1); rel(v.dmg/d0,1+0.004*5*4,'Running Heat: 0.4% x 5 a Craze');
  rel(inRatio(L,{src:F0}),0.8*(1-0.004*3*4),'Safety Glass 20% x Heat Shimmer 0.4% x 3 x 4 (F0 is 0.5 m away)'); rel(inRatio(L,{src:F1}),0.8,'F1 6 m away: Safety Glass only');
  at(L,A0,0,-5.5); rel(allyRatio(L,A0,F0),1-0.004*3*4,'Heat Shimmer on an ally hit by F0'); rel(allyRatio(L,A0,F1),1);
  const want=VMX('(function(s,t,x){ const a=defMul(s,t,"phys"); const sv=s._wpnArmIgn; s._wpnArmIgn=x; const b=defMul(s,t,"phys"); s._wpnArmIgn=sv; return b/a; })')(v,F0,0.004*5*4);
  rel(ratio(L,F0,{kind:'phys'}),want,'Fault Lines: 0.4% x 5 of its armor a Craze ignored');
  F0.dots=[]; hitOn(L,10,{src:F0}); const D=myDots(L,F0,'peBrit'); assert.equal(D.length,1,'Brittle Edge'); rel(dotTotal(D[0]),0.05*ATK(L),'1% x 5 of his attack over 2 s');
  hitOn(L,10,{src:F0}); assert.equal(myDots(L,F0,'peBrit').length,1,'renewed, not stacked');
  setStack(L,'peCraze',3); rel(inRatio(L,{src:F1}),1,'Safety Glass: not at 3'); F1.dots=[]; hitOn(L,10,{src:F1}); assert.equal(myDots(L,F1,'peBrit').length,1,'Brittle Edge at 3');
  setStack(L,'peCraze',2); F1.dots=[]; hitOn(L,10,{src:F1}); assert.equal(myDots(L,F1,'peBrit').length,0,'not at 2');
});

test('Pellucid / Glassblower\'s Breath (the grab burns at double strength, Flow or not, and adds 2 Craze), Burning Hands (his burns 3% x 5 more)',()=>{
  let L=pl(S(['gc_7_1','gc_6_2']),{foes:2}); const v=L.v, F0=L.F[0]; F0.dmg=1e4; free(F0);
  castOn(L,'blue',F0); const D=myDots(L,F0,'peGb'); assert.equal(D.length,1); assert.equal(stack(L,'peCraze'),2,'2 Craze');
  const tot=dotTotal(D[0]); assert.ok(tot>0); const l=lost(F0,()=>secs(3.2)); rel(l,tot*1.15,'all of it 15% more (Burning Hands)',1e-3);
  L=pl(S(['gc_7_1']),{foes:2}); L.F[0].dmg=1e4; free(L.F[0]); const h=L.F[0].hp; castOn(L,'blue',L.F[0]); const dealt=h-L.F[0].hp; rel(dotTotal(myDots(L,L.F[0],'peGb')[0]),2*0.04*dealt,'twice one rank of the Flow\'s burn (4%) of the grab\'s hit',1e-6);
});

test('Pellucid / The Flow That Stopped (SIGNATURE): once a fight he does not fall; 6 s at 1 HP or more as the Flow, enemies within 3 m burn 50% a second; then a 30% shield',()=>{
  const L=pl(S(['gc_13_2','gc_8_2']),{foes:3}); const v=L.v, [F0,F1]=L.F; v.hp=100; v.shield=0; V.hit(F1,v,1e4,{kind:'true'}); assert.ok(v.alive); assert.equal(v.hp,1,'held at 1 HP');
  near(win(L,'peFlow'),6,'6 s of the Flow',0.05); V.hit(F1,v,1e4,{kind:'true'}); assert.ok(v.alive&&v.hp>=1,'and cannot drop below 1 HP');
  const a=lost(F0,()=>secs(1.03)), b=lost(F1,()=>{}); rel(a,0.5*ATK(L),'an enemy 0.5 m away: 50% of his attack a second',1e-3); assert.equal(lost(F1,()=>secs(1.03)),0,'not 6 m away');
  v.shield=0; secs(4.2); rel(v.shield,0.30*v.maxHp,'the Reglaze at its end: 30% of his max HP',1e-3);
  v.shield=0; v.hp=10; V.hit(F1,v,1e4,{kind:'true'}); assert.ok(!v.alive,'once a fight');
});

test('Pellucid / Check: Meteor Knuckle\'s stun Checks 4 s + Checking Line + Opening Move (the first each wave); 2% x 3 less to everyone but him; Check Pressure, Glass Behind Stone, Check Weight',()=>{
  let L=pl(S(['rk_1_1','rk_3_1','rk_6_1','rk_5_1','rk_n2','rk_10_1']),{foes:3,allies:1}); const v=L.v, [F0,F1]=L.F, A0=L.A[0]; free(F0); at(L,A0,0,-5.5);
  castOn(L,'green',F0); near(left(L,F0,'peChk'),4+2.5+2,'8.5 s (the first of the wave)',0.05); assert.ok(!mark(L,F1,'peChk'));
  rel(allyRatio(L,A0,F0),0.94,'an ally hit by a Checked enemy: 2% x 3 less'); rel(allyRatio(L,A0,F1),1);
  for(const f of L.F) setMk(L,f,'peChk',1); rel(inRatio(L,{src:F1}),0.97*(1-0.025*3),'three Checked'); for(const f of L.F){ const M=f._talM[L.v.uid]; delete M.peChk; } setMk(L,F0,'peChk',8); rel(inRatio(L,{src:F0}),0.97*(1-0.025),'him: Glass Behind Stone 3% x Check Weight 0.5% x 5 for one Checked'); rel(inRatio(L,{src:F1}),1-0.025,'Check Weight from anyone');
  rel(ratio(L,F0),1.075,'Check Pressure: his hit 1.5% x 5 more'); rel(allyRatio(L,F0,A0),1.075,'and his ally\'s'); rel(ratio(L,F1),1);
  secs(3); F0.stunned=0; castOn(L,'green',F0); near(left(L,F0,'peChk'),6.5,'the second of the wave: 6.5 s',0.05);
  secs(6.6); assert.ok(!mark(L,F0,'peChk'),'it ends');
});

test('Pellucid / Check: Discovered Check (the nearest enemy 1 s x 3), Forced Move (15% x 2 for 2 s on leaving), Perpetual Check (+0.5 s and renewed)',()=>{
  let L=pl(S(['rk_1_1','rk_7_1']),{foes:4}); let [F0,F1]=L.F; setMk(L,F0,'peChk',4); F0.hp=1; V.hit(L.v,F0,100,{kind:'true'}); assert.ok(!F0.alive);
  near(left(L,F1,'peChk'),3,'the nearest enemy: 3 s',0.05);
  L=pl(S(['rk_1_1','rk_12_1']),{foes:2}); [F0]=L.F; free(F0); castOn(L,'green',F0); secs(3.9); assert.ok(!(F0.slow>0)); secs(0.3); assert.ok(F0.slow>0,'leaving Check: slowed'); near(F0.slowMul,0.70,'30%'); near(F0.slow,2,'for 2 s',0.2);
  L=pl(S(['rk_1_1','rk_9_1']),{foes:2}); [F0]=L.F; free(F0); castOn(L,'green',F0); near(F0.stunned,1.4,'not yet in Check: 1.4 s'); secs(2); assert.ok(left(L,F0,'peChk')<2.1);
  castOn(L,'green',F0); near(F0.stunned,1.9,'already in Check: 0.5 s longer'); near(left(L,F0,'peChk'),4,'and renewed',0.05);
  L=pl(S(['rk_10_1']),{foes:5}); for(const f of L.F) setMk(L,f,'peChk',9); rel(inRatio(L,{src:L.F[0]}),1-0.025*4,'Check Weight: 5 enemies in Check count as 4');
});

test('Pellucid / Unmoved: a refused pull or push (max 5 + 3), Hold the Corner, Corner Stone, Weight of the Rook, Planted Fists, Glass Endgame, No Retreat, this wave only',()=>{
  const L=pl(S(['rk_1_4','rk_2_4','rk_8_4','rk_4_4','rk_6_4','rk_9_4','rk_10_4']),{foes:2}); const v=L.v, F0=L.F[0], d0=v.dmg, h0=v.maxHp, x0=v.x;
  v.greenCd=20; enemyCast(F0,v,'pullsilence',{radius:5*M_(),dur:2}); assert.equal(stack(L,'peUnm'),1,'a pull he did not move for'); near(v.greenCd,19,'No Retreat: 0.2 s x 5'); assert.equal(v.x,x0);
  for(let i=0;i<9;i++) enemyCast(F0,v,'knockstun',{mul:0.01,stun:0.1,push:1.6*M_()}); assert.equal(stack(L,'peUnm'),8,'max 8 (Stone Patience)'); near(v.greenCd,19-7,'only for each one gained');
  v.silencedT=0; V.step(1); rel(v.dmg/d0,1.40,'Hold the Corner: 1% x 5 each'); rel(v.maxHp/h0,1.08,'Corner Stone: 0.2% x 5 each'); rel(inRatio(L),1-0.02*8,'Weight of the Rook: 0.4% x 5 each');
  rel(ratio(L,F0,{auto:true}),1+0.015*8,'Planted Fists: 0.5% x 3 each on his basic attacks'); rel(ratio(L,F0),1);
  assert.ok(!(v.lifestealStat>0)); v.hp=0.45*v.maxHp; V.step(1); near(v.lifestealStat||0,0,'not at 45%'); v.hp=0.39*v.maxHp; V.step(1); near(v.lifestealStat,0.015*8,'Glass Endgame below 40%: 0.3% x 5 each'); v.hp=v.maxHp; V.step(1); near(v.lifestealStat||0,0);
  V.wave(); V.step(1); assert.equal(stack(L,'peUnm'),0,'cleared at the next wave');
});

test('Pellucid / Castle Wall (at 5 Unmoved a molten layer from every 2 direct hits), Molten Plates (0.3% x 3 a layer more), Molten Heart and Warm Layers',()=>{
  let L=pl(S(['rk_1_4','rk_3_4']),{foes:2}); const v=L.v; v.wardenStk=0; v._mmHits=0; setStack(L,'peUnm',4); hitOn(L,10); hitOn(L,10); assert.equal(v.wardenStk,0,'at 4: not');
  setStack(L,'peUnm',5); v._mmHits=0; hitOn(L,10); assert.equal(v.wardenStk,0); hitOn(L,10); assert.equal(v.wardenStk,1,'at 5: the 2nd hit');
  L=pl(S(['rk_2_2','fm_8_3','gc_9_3']),{foes:2}); L.v.wardenStk=0; V.step(1); const d0=L.v.dmg; L.v.wardenStk=5; V.step(1); rel(inRatio(L),1-0.003*3*5,'Molten Plates: 0.9% a layer on top'); rel(L.v.dmg/d0,1+2*0.005*5*5,'0.5% x 5 a layer, each');
});

test('Pellucid / the Guarded File: the ally most directly behind him; The File Behind, Two Files, Rook\'s Watch, File Guard, Rook and King, Long File',()=>{
  let L=pl(S(['rk_2_3','rk_6_3','rk_8_3','rk_10_3','rk_4_3']),{foes:3,allies:2}); const v=L.v, [F0,F1]=L.F, [A0,A1]=L.A;
  at(L,A0,-6,0); at(L,A1,-6,4.5); V.step(1); assert.ok(pe(L).file.length===1&&pe(L).file[0]===A0,'behind him, the least off the line'); at(L,A0,-6,0); at(L,A1,-6,4.5);
  rel(allyRatio(L,A0,F0),0.95,'1% x 5 less'); rel(allyRatio(L,A1,F0),1,'not the other'); rel(ratio(L,F0),1.05,'his hits on an enemy that attacked it: 1% x 5 more'); rel(ratio(L,F1),1);
  near(F0.slowMul,0.90,'File Guard: 2% x 5'); assert.ok(F0.slow>0); rel(inRatio(L),0.95,'Rook\'s Watch: 1% x 5 while an ally is on his file');
  rel(allyRatio(L,F0,A0),1.05,'Rook and King: the file ally deals 1% x 5 more'); rel(allyRatio(L,F0,A1),1);
  A0.hp=0.5*A0.maxHp; pe(L).lfA=0; const h=A0.hp; at(L,A0,-6,0); secs(2.02); rel((A0.hp-h)/A0.maxHp,0.012,'Long File: 0.2% x 3 of its max HP a second',1e-3);
  L=pl(S(['rk_2_3','rk_5_3']),{foes:3,allies:2}); at(L,L.A[0],-6,0); at(L,L.A[1],-6,4.5); V.step(1); assert.equal(pe(L).file.length,2,'Two Files: both');
  at(L,L.A[0],5,-6); at(L,L.A[1],0,-12); V.step(1); assert.equal(pe(L).file.length,0,'nobody behind him (beside him is not behind)');
});

test('Pellucid / Closed Board (PICK ONE: the first hit on the file ally once every 6 s lands on him), Interpose (1 s x 3 less)',()=>{
  const L=pl(S(['rk_2_3','rk_5_2','rk_6_2']),{foes:3,allies:1}); const v=L.v, F0=L.F[0], A0=L.A[0]; at(L,A0,-6,0); V.step(1); at(L,A0,-6,0);
  const a=lost(A0,()=>{}); let hv=v.hp, ha=A0.hp; V.hit(F0,A0,1000,{kind:'true'}); assert.equal(A0.hp,ha,'the ally takes nothing'); rel(hv-v.hp,950*(1-VMX('(u=>wardenCut(u))')(v)),'he takes it (after the ally 5 percent, then his own molten layers)',1e-3);
  hv=v.hp; ha=A0.hp; V.hit(F0,A0,1000,{kind:'true'}); rel(ha-A0.hp,950,'the next one lands on the ally'); assert.equal(v.hp,hv);
  secs(2.8); ha=A0.hp; V.hit(F0,A0,1000,{kind:'true'}); assert.ok(A0.hp<ha,'2.8 s later: not yet'); secs(0.3); ha=A0.hp; hv=v.hp; at(L,A0,-6,0); V.step(1); at(L,A0,-6,0); V.hit(F0,A0,1000,{kind:'true'}); assert.equal(A0.hp,ha,'after 3 s again'); assert.ok(v.hp<hv);
});

test('Pellucid / Castling Wall (each slam shields the file ally 4% of his max HP, Hold the File 3% x 5 stronger; the third slam Checks), Glass Behind Stone with Reglaze (half of it)',()=>{
  let L=pl(S(['rk_2_3','rk_11_3','rk_12_3']),{foes:3,allies:1}); const v=L.v, F0=L.F[0], A0=L.A[0]; free(F0); at(L,A0,-6,0); V.step(1); at(L,A0,-6,0); A0.shield=0;
  castOn(L,'ult',F0); secs(0.05); rel(A0.shield,0.04*1.15*v.maxHp,'the first slam'); secs(2.2); rel(A0.shield,3*0.04*1.15*v.maxHp,'three slams',1e-6); assert.ok(mark(L,F0,'peChk'),'the third slam\'s stagger: in Check');
  L=pl(S(['rk_2_3','rk_n2','gc_1_4','gc_1_2']),{foes:2,allies:1}); at(L,L.A[0],-6,0); V.step(1); at(L,L.A[0],-6,0); L.A[0].shield=0; L.v.shield=0; openWin(L,'peFlow',0.03); V.step(3);
  rel(L.A[0].shield,0.5*L.v.shield,'Glass Behind Stone: half of his Reglaze');
  L=pl(S(['rk_2_3','rk_n2','gc_1_2','gc_9_4']),{foes:2,allies:1}); at(L,L.A[0],-6,0); V.step(1); L.A[0].shield=0; openWin(L,'peFlow',0.03); V.step(3); assert.equal(L.A[0].shield||0,0,'not without Reglaze');
});

test('Pellucid / Cannot Be Moved (SIGNATURE): the file ally below 30%: 4 s, its attackers Checked and taunted onto him, 5 Unmoved, full molten armour, 50% less on it; once every 25 s, across a wave change',()=>{
  const L=pl(S(['rk_2_3','rk_13_3']),{foes:3,allies:1}); const v=L.v, [F0,F1,F2]=L.F, A0=L.A[0]; at(L,A0,-6,0); V.step(1); at(L,A0,-6,0); v.wardenStk=0;
  F1.target=A0; F2.target=A0; A0.hp=0.32*A0.maxHp; V.step(1); assert.ok(!pe(L).cbm,'not at 32%'); A0.hp=0.29*A0.maxHp; V.step(1);
  assert.ok(pe(L).cbm,'the file closes'); for(const f of [F1,F2]){ assert.ok(mark(L,f,'peChk'),'its attacker in Check'); assert.equal(f.forcedTarget,v,'taunted onto him'); } assert.ok(!mark(L,F0,'peChk'),'not one that does not target it');
  assert.equal(stack(L,'peUnm'),5); assert.equal(v.wardenStk,5,'full molten armour'); rel(allyRatio(L,A0,F1),0.5,'50% less, in place of the group');
  secs(4.1); assert.ok(!pe(L).cbm,'4 s'); rel(allyRatio(L,A0,F1),0.95,'back to the group');
  A0.hp=A0.maxHp; V.step(1); A0.hp=0.2*A0.maxHp; V.step(1); assert.ok(!pe(L).cbm,'the 25 s lock');
  VMX('battleTime=0'); V.wave(); V.step(1); at(L,A0,-6,0); A0.hp=A0.maxHp; V.step(1);   // a new wave: the fight clock starts again at 0
  secs(25-4.1-0.2-0.6); A0.hp=0.2*A0.maxHp; F1.target=A0; V.step(1); assert.ok(!pe(L).cbm,'still locked 24.4 s after it fired (the clock reset changes nothing)');
  A0.hp=A0.maxHp; V.step(1); secs(0.8); at(L,A0,-6,0); V.step(1); A0.hp=0.2*A0.maxHp; V.step(1); assert.ok(pe(L).cbm,'and free again 25 s after it fired');
});

test('Pellucid / Rook: Blocked Lines, Board Edge, Stand Fast (until 3 s after his stun ends), Last Rank, Slow Board, Rook\'s Patience, Unmovable, Crushing Grip, Grand Fist, Square Fist',()=>{
  let L=pl(S(['rk_8_2','rk_7_4','rk_11_4','rk_12_4','rk_11_2','rk_12_2','rk_5_4','rk_9_2','rk_7_2','rk_4_2']),{foes:3}); const v=L.v, [F0,F1]=L.F;
  rel(inRatio(L,{src:F0}),1,'a melee attacker'); F0.melee=false; rel(inRatio(L,{src:F0}),0.94,'Blocked Lines: a ranged one, 2% x 3'); F0.melee=true;
  rel(ratio(L,F0),1.10,'Board Edge: a front-row enemy, 2% x 5'); const k=F0.key; F0.key='sylthaine'; rel(ratio(L,F0),1,'not a back-row one'); F0.key=k;
  free(F0); castOn(L,'green',F0); rel(inRatio(L,{src:F0}),0.90,'Stand Fast: 2% x 5 from an enemy he stunned'); rel(inRatio(L,{src:F1}),1); secs(1.4+2.9); rel(inRatio(L,{src:F0}),0.90,'still 2.9 s after the stun ended'); secs(0.2); rel(inRatio(L,{src:F0}),1,'not after 3 s');
  v.hp=0.32*v.maxHp; rel(hitOn(L,100,{keep:true})/plainHit(L,()=>{ v.hp=0.32*v.maxHp; return hitOn(L,100,{keep:true}); }),1,'not at 32%'); v.hp=0.29*v.maxHp; rel(hitOn(L,100,{keep:true})/plainHit(L,()=>{ v.hp=0.29*v.maxHp; return hitOn(L,100,{keep:true}); }),0.94,'Last Rank below 30%: 2% x 3'); v.hp=v.maxHp;
  const F2=L.F[2]; V.step(2); rel(F0.atkInterval/F2.atkInterval,1/0.95,'Slow Board: an enemy 0.5 m away 1% x 5 slower'); rel(F1.atkInterval/F2.atkInterval,1,'not 6 m away');
  near(FX.cd(v,'blue',10),9.1,'Rook\'s Patience: 0.3 s x 3'); near(FX.cd(v,'green',8),8);
  near(FX.cc(F1,v,'stunned',2,false),1.6,'Unmovable: 4% x 5 shorter'); F1.key='sylthaine';   // out of the front row: Board Edge off for the ratios below
  const want=VMX('(function(s,t,x){ const a=defMul(s,t,"phys"); const sv=s._wpnArmIgn; s._wpnArmIgn=x; const b=defMul(s,t,"phys"); s._wpnArmIgn=sv; return b/a; })')(v,F1,0.10);
  rel(ratio(L,F1,{kind:'phys'}),want*1.0,'Crushing Grip: 2% x 5 of its armor ignored');
  rel(skillRatio(L,F1,'aoeStun'),1.15,'Grand Fist: 3% x 5'); rel(skillRatio(L,F1,'atkcrush'),1.12,'Square Fist: 4% x 3'); F1.key='vael';
});

test('Pellucid / Knuckle Heat: Hot Knuckles (1.5% x 5 a Heat spent), White Hot Fists (9), Coal in the Knuckles, Furnace Breath, Burning Knuckles, Rising Fire, Searing Spend, Fire Fists',()=>{
  let L=pl(S(['fm_1_1','fm_2_1','fm_6_1','fm_4_1','fm_7_1','fm_12_2','fm_3_1','fm_10_1']),{foes:2}); const v=L.v, F0=L.F[0], d0=v.dmg;
  assert.equal(stack(L,'peHeat'),6,'Coal in the Knuckles: 2 x 3 at the wave start'); rel(ratio(L,F0,{auto:true}),1+0.025*6,'Furnace Breath: 0.5% x 5 a Heat (6)',1e-6);
  for(let i=0;i<4;i++) V.hit(v,F0,10,{kind:'true',auto:true}); assert.equal(stack(L,'peHeat'),9,'max 9');
  F0.dots=[]; const hf0=F0.hp; V.hit(v,F0,1000,{kind:'true',auto:true}); const D=myDots(L,F0,'peFire'); assert.equal(D.length,1,'Fire Fists at 6+'); rel(dotTotal(D[0]),0.15*(hf0-F0.hp),'3% x 5 of the hit');
  v.hp=0.5*v.maxHp; free(F0); const hp0=v.hp, h=F0.hp; castOn(L,'green',F0); assert.equal(stack(L,'peHeat'),0,'Meteor Knuckle spends it all');
  rel((v.hp-hp0)/v.maxHp,0.009*9,'Burning Knuckles: 0.3% x 3 of his max HP a Heat'); const S0=myDots(L,F0,'peSear'); assert.equal(S0.length,1,'Searing Spend: 6+ spent');
  rel(dotTotal(S0[0]),0.25*(h-F0.hp-0),'25% of the hit over 3 s',1e-6); V.step(1); rel(v.dmg/d0,1+0.015*9,'Rising Fire: 0.3% x 5 a Heat for 5 s'); secs(5.1); rel(v.dmg/d0,1,'gone after 5 s');
  pe(L).sp=9; rel(skillRatio(L,F0,'aoeStun'),1+0.075*9,'Hot Knuckles: 1.5% x 5 for each of 9 spent'); pe(L).sp=0;
  setStack(L,'peHeat',4); F0.dots=[]; V.hit(v,F0,1000,{kind:'true',auto:true}); assert.equal(myDots(L,F0,'peFire').length,0,'Fire Fists: not below 6 (5 after this hit)'); setStack(L,'peHeat',5); F0.dots=[]; F0.stunned=0; V.step(1); F0.stunned=0; castOn(L,'green',F0); assert.equal(myDots(L,F0,'peSear').length,0,'Searing Spend: not at 5');
});

test('Pellucid / Held Fast: the grabbed enemy 4 s + 0.5 x 3 (Iron Grip): basic attacks 3% x 5 more, no heal above its HP at the grab; Fist Speed, Grinding Hold',()=>{
  const L=pl(S(['fm_2_2','fm_4_2','fm_2_3','fm_9_2']),{foes:3,allies:1}); const v=L.v, [F0,F1]=L.F, A0=L.A[0], ai=v.atkInterval; F1.dmg=1e4; free(F1);
  castOn(L,'blue',F1); near(left(L,F1,'peHF'),5.5,'5.5 s',0.05); rel(ratio(L,F1,{auto:true}),1.15*1.05,'basic attacks: 3% x 5 (and Grinding Hold 1% x 5)'); rel(ratio(L,F1),1.05,'Grinding Hold: his other hits');
  rel(allyRatio(L,F1,A0),1.05,'Grinding Hold: his ally\'s'); rel(ratio(L,F0,{auto:true}),1);
  const cap=pe(L).hfHp[F1.uid]; F1.hp=cap-5000; V.heal(F1,1e9); assert.ok(Math.abs(F1.hp-cap)<1e-3,'healed no higher than when it was grabbed: '+(F1.hp-cap)); near(F1.hp,cap,'healed no higher than when it was grabbed'); V.step(1); rel(v.atkInterval/ai,0.91,'Fist Speed: 3% x 3 shorter while one is Held Fast');
  secs(5.6); assert.ok(!mark(L,F1,'peHF')); F1.hp=cap-5000; V.heal(F1,3000); near(F1.hp,cap-2000,'healing is free again'); V.step(1); rel(v.atkInterval/ai,1);
});

test('Pellucid / Held Fast ends: Throw Them Down (50% x 1.3 to it and every enemy within 2 m, a 0.5 s stun under the stun-lock rule), Crush the Arms (silenced while Held Fast), The Mountain Falls Twice',()=>{
  let L=pl(S(['fm_2_2','fm_5_3','fm_6_3']),{foes:4}); let [F0,F1,F2,F3]=L.F; for(const f of L.F) free(f); F0.dmg=1e4; at(L,F3,4.5,4.6);   // F3 0.6 m from F0, body to body
  castOn(L,'blue',F0); const h0=F0.hp, h3=F3.hp, h1=F1.hp, h2=F2.hp; at(L,F3,4.5,4.6); secs(3.95); at(L,F3,4.5,4.6); assert.ok(F0.hp===h0); secs(0.1);
  rel(h0-F0.hp,0.5*1.3*ATK(L),'it takes 50% + 30% (Ground Crater)',1e-3); rel(h3-F3.hp,0.5*1.3*ATK(L),'an enemy within 2 m too',1e-3); assert.ok(F1.hp<h1,'F1 too: 1.5 m from it'); assert.equal(F2.hp,h2,'not F2');
  near(F0.stunned,0.45,'stunned 0.5 s',0.06); near(F3.stunned,0.45,'',0.06);
  L=pl(S(['fm_2_2','fm_5_3']),{foes:2}); [F0]=L.F; free(F0); F0.dmg=1e4; castOn(L,'blue',F0); secs(3.9); F0.stunned=0.3; secs(0.2); assert.ok(F0.stunned<0.3,'not on an enemy already stunned');
  L=pl(S(['fm_2_2','fm_5_2']),{foes:2}); [F0]=L.F; free(F0); F0.dmg=1e4; castOn(L,'blue',F0); secs(3.5); assert.ok(F0.silencedT>0,'Crush the Arms: silenced'); secs(0.7); V.step(5); assert.ok(!(F0.silencedT>0),'not after it');
  L=pl(S(['fm_2_2','fm_7_2']),{foes:2}); [F0]=L.F; free(F0); F0.dmg=1e4; castOn(L,'blue',F0); F0.stunned=0; const a=F0.hp; castOn(L,'green',F0); const mk=a-F0.hp;
  const b=F0.hp; secs(0.55); assert.equal(F0.hp,b); secs(0.1); rel(b-F0.hp,0.5*mk,'a second fist 0.6 s later for half',1e-3);
});

test('Pellucid / Tremor: 1 s after Meteor Knuckle 10% x 3 of each hit again (Long Rumble, Echoing Ground, First Shock once a wave), Rolling Shock, Settling Ground; Worldbreaker\'s third slam only',()=>{
  let L=pl(S(['fm_1_4','fm_12_4','fm_7_4','fm_3_4','fm_6_4','fm_10_4']),{foes:2}); const v=L.v, F0=L.F[0];   // F0 stays held: stunned, so Echoing Ground counts
  let a=F0.hp; castOn(L,'green',F0); const hit=a-F0.hp; v.greenCd=8; let b=F0.hp; secs(0.95); assert.equal(F0.hp,b,'not yet'); secs(0.1);
  rel(b-F0.hp,0.30*1.09*1.10*1.40*hit,'10% x 3, Long Rumble 3% x 3, Echoing Ground 2% x 5 (stunned), First Shock 20% x 2',1e-3); near(F0.slowMul,0.80,'Rolling Shock: 4% x 5'); near(v.greenCd,8-0.5,'Settling Ground: 0.1 s x 5 (held: his own cooldown does not run)');
  a=F0.hp; castOn(L,'green',F0); const hit2=a-F0.hp; b=F0.hp; secs(1.05); rel(b-F0.hp,0.30*1.09*1.10*hit2,'the second: no First Shock',1e-3);
  L=pl(S(['fm_1_4']),{foes:2}); const F=L.F[0]; const n=[]; const keep=F.hp; castOn(L,'ult',F); let last=F.hp;
  for(let i=0;i<130;i++){ V.step(1); if(F.hp<last){ n.push(+(last-F.hp).toFixed(1)); last=F.hp; } }
  assert.equal(n.length,4,'three shockwave hits and one Tremor: '+n); rel(n[3],0.30*n[2],'the third slam Tremor',1e-2);
});

test('Pellucid / Worldshaker (every slam a Tremor; the third slam\'s stuns 0.4 s under the stun-lock rule), Deep Quake (0.3 m x 3 beyond)',()=>{
  let L=pl(S(['fm_1_4','fm_9_4','fm_7_4','fm_5_4']),{foes:2}); let F=L.F[0]; free(F); F.level=500;   // her level is too high for the slams' own stun to land
  const n=[]; let last=F.hp; castOn(L,'ult',F); let st=0; for(let i=0;i<130;i++){ V.step(1); if(F.hp<last){ n.push(last-F.hp); last=F.hp; } st=Math.max(st,F.stunned||0); }
  assert.equal(n.length,6,'three hits, three Tremors'); near(st,0.4,'the third Tremor stuns 0.4 s',0.03);
  L=pl(S(['fm_1_4','fm_9_4']),{foes:2}); F=L.F[0]; free(F); let mx=0, got=0; castOn(L,'ult',F); for(let i=0;i<130;i++){ const s0=F.stunned||0; V.step(1); if((F.stunned||0)>s0+0.01) got++; mx=Math.max(mx,F.stunned||0); }
  near(mx,2.8,'the slams stun it',1e-3); assert.equal(got,3,'three slam stuns and no Tremor stun on a stunned enemy');
  L=pl(S(['fm_1_4','fm_5_4']),{foes:4}); const [F0,F1,F2,F3]=L.F; at(L,F3,4.5,4.82); const a=F0.hp, a3=F3.hp; castOn(L,'green',F0); const hit=a-F0.hp; assert.equal(F3.hp,a3,'Meteor Knuckle does not reach it');
  at(L,F3,4.5,4.82); secs(1.05); rel(a3-F3.hp,0.30*hit,'an enemy 0.8 m from the one struck: the Tremor (10% x 3) reaches it',1e-3);
});

test('Pellucid / stun extensions: Crushing Weight (+0.1 x 3), Hold Tighter (+0.1 x 3), Open Hearth (+0.1 a Heat spent), at most 4 s',()=>{
  let L=pl(S(['fm_12_1','fm_10_2','fm_11_2','fm_1_1']),{foes:2}); const F0=L.F[0]; free(F0); castOn(L,'green',F0); near(F0.stunned,1.7,'Meteor Knuckle 1.4 + 0.3');
  F0.stunned=0; F0.dmg=1e4; setStack(L,'peHeat',6); castOn(L,'blue',F0); near(F0.stunned,2.45+0.3+0.6,'Infernal Clinch 2.45 + 0.3 + 6 x 0.1');
  F0.stunned=0; setStack(L,'peHeat',30); castOn(L,'blue',F0); near(F0.stunned,4.0,'at most 4 s');
});

test('Pellucid / Falling Mountain: Bigger Fist, First Knock, Bonebreaker, Lava Veins, Smelted, Clinch Strength, Ironglass Fists, Heavy Knuckle, Crater Maker, Blown Glass',()=>{
  let L=pl(S(['fm_4_3']),{foes:3}); let [F0,F1,F2]=L.F; at(L,F2,4.5,3.1); let h=F2.hp; castOn(L,'green',F0); assert.ok(F2.hp<h,'Bigger Fist: 3.1 m from its spot, 0.2 m x 3 wider');
  L=pl(null,{foes:3}); [F0,F1,F2]=L.F; at(L,F2,4.5,3.1); h=F2.hp; castOn(L,'green',F0); assert.equal(F2.hp,h,'(not without it)');
  L=pl(S(['fm_n2','fm_11_1','fm_11_3','fm_8_1','fm_6_2','gc_11_4','gc_4_3','fm_9_3','gc_12_3']),{foes:3}); const v=L.v; [F0,F1,F2]=L.F;
  free(F1); rel(ratio(L,F1,{auto:true}),1.40,'First Knock: 8% x 5 on the first basic attack on it'); rel(ratio(L,F1,{auto:true}),1,'not the second');
  rel(ratio(L,F0),1.15,'Bonebreaker: a stunned (held) enemy 3% x 5'); rel(ratio(L,F1),1);
  v.hp=0.5*v.maxHp; const hp0=v.hp, hb=F1.hp; L.T.s.cur='aoeStun'; V.hit(v,F1,1000,{kind:'true'}); L.T.s.cur=null; rel(v.hp-hp0,0.05*(hb-F1.hp),'Lava Veins: 1% x 5 of what his skill dealt'); v.hp=v.maxHp;
  const want=VMX('(function(s,t,x){ const a=defMul(s,t,"phys"); const sv=s._wpnArmIgn; s._wpnArmIgn=x; const b=defMul(s,t,"phys"); s._wpnArmIgn=sv; return b/a; })')(v,F1,0.10);
  rel(ratio(L,F1,{kind:'phys'}),want,'Smelted: 2% x 5 of its armor ignored');
  rel(skillRatio(L,F1,'atkcrush'),1.15*1.15,'Clinch Strength 3% x 5, Ironglass Fists 3% x 5'); rel(skillRatio(L,F1,'aoeStun'),1.12,'Heavy Knuckle 4% x 3'); rel(skillRatio(L,F1,'wb1'),1.15*1.09,'Crater Maker 3% x 5, Blown Glass 3% x 3');
});

test('Pellucid / The Valley Remembers (SIGNATURE): 6+ Heat spent on a Held Fast enemy: a critical, two Tremors 0.5 s apart within 4 m, the Heat full; once every 20 s',()=>{
  const L=pl(S(['fm_1_1','fm_2_2','fm_13_2']),{foes:3}); const v=L.v, [F0,F1,F2]=L.F; F0.dmg=1e4; free(F0); at(L,F2,4.5,4.6);
  const cr=1+Math.max(0,(v.critDmg||0.6)-(F0.critRes||0)); setStack(L,'peHeat',6); let a=F0.hp; castOn(L,'blue',F0); const hit=a-F0.hp;
  const plainCl=c=>plainHit(L,()=>{ const b=F0.hp; F0.stunned=0; VMX('(function(u,c){ const p=_preCrit; _preCrit=c; u._castSlot="blue"; u._castLv=10; u._castSM=skillMul(10); try{ doEffect(u,"atkcrush",u.blueAb); } finally{ u._castSlot=null; u._castLv=0; u._castSM=1; _preCrit=p; } })')(v,c); return b-F0.hp; });
  const pa=plainCl(false), pc=plainCl(true); assert.ok(pc>pa*1.2,'(a plain critical is bigger)');
  rel(hit/pc,(1+0.075*6),'a critical (and Hot Knuckles for 6 spent)',1e-3); assert.equal(stack(L,'peHeat'),6,'the Heat refills to full');
  const t0=F0.hp, t2=F2.hp; at(L,F2,4.5,4.6); secs(0.55); rel(t0-F0.hp,0.10*hit,'the first Tremor (one rank: 10%)',1e-3); rel(t2-F2.hp,0.10*hit,'on an enemy within 4 m too',1e-3); const t1=F0.hp; secs(0.5); rel(t1-F0.hp,0.10*hit,'the second, 0.5 s later',1e-3);
  F0.stunned=0; setStack(L,'peHeat',6); a=F0.hp; castOn(L,'blue',F0); rel((a-F0.hp)/pa,(1+0.075*6),'within 20 s: no critical',1e-3);
  secs(14); F0.stunned=0; setStack(L,'peHeat',6); a=F0.hp; castOn(L,'blue',F0); rel((a-F0.hp)/pa,(1+0.075*6),'16 s after: still none',1e-3);
  secs(5.5); F0.stunned=0; setStack(L,'peHeat',5); a=F0.hp; castOn(L,'blue',F0); rel((a-F0.hp)/pa,(1+0.075*5),'5 Heat: none',1e-3);
  F0.stunned=0; setStack(L,'peHeat',6); a=F0.hp; castOn(L,'blue',F0); rel((a-F0.hp)/pc,(1+0.075*6),'after 20 s again (6 Heat)',1e-3);
});

test('Pellucid / the caps: his damage reduction one group (40%), control shortening one group (30%); the cuts on his allies multiply',()=>{
  let L=pl(S(['gc_3_1','gc_5_3','gc_12_2','rk_4_4','rk_2_4','rk_6_3','rk_2_3','rk_8_2','rk_11_4','rk_12_4','rk_10_1','rk_1_1','rk_n2','rk_2_2','gc_6_1','gc_10_3','gc_n1']),{foes:5,allies:1});
  const v=L.v, F0=L.F[0], A0=L.A[0]; at(L,A0,-6,0); V.step(1); at(L,A0,-6,0); setStack(L,'peCraze',4); setStack(L,'peUnm',8); openWin(L,'peHold'); openWin(L,'peFlow'); for(const f of L.F){ setMk(L,f,'peChk',99); setMk(L,f,'peStn',99); }
  v.wardenStk=5; F0.melee=false; v.hp=0.25*v.maxHp; rel(hitOn(L,100,{keep:true,crit:false})/plainHit(L,()=>{ v.hp=0.25*v.maxHp; return hitOn(L,100,{keep:true}); }),0.60,'at most 40% (the shares multiply to far more without the cap)');
  rel(allyRatio(L,A0,F0),0.95*0.94*(1-0.004*3*4),'his allies: The File Behind, Check and Heat Shimmer multiply (15.1% at most: no cap needed)');
  L=pl(S(['rk_5_4','fm_12_3']),{foes:2}); near(FX.cc(L.F[0],L.v,'silencedT',2,false),1.4,'a silence: 30% (36% without the cap)'); near(FX.cc(L.F[0],L.v,'stunned',2,false),1.6,'a stun: Unmovable 20%');
});

test('Pellucid: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['gc_1_1','gc_1_2','gc_1_4','fm_1_1','fm_2_2','fm_1_4','rk_1_1','rk_2_3']), TEAM=['pellucid','vael','sylthaine','vireo','meridian'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  const mx={}; let flow=false, chk=false, hf=false, file=false;
  for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ V.step(1); const T0=s._tal.s; for(const k in T0.k) mx[k]=Math.max(mx[k]||0,T0.k[k].n); if(T0.w.peFlow&&T0.w.peFlow.t>0) flow=true; if(T0.pe&&T0.pe.file&&T0.pe.file.length) file=true;
    for(const f of U.filter(u=>u.team==='enemy')){ const o=f._talM&&f._talM[s.uid]; if(!o) continue; if(o.peChk) chk=true; if(o.peHF) hf=true; } }
  console.log('  live fight: max '+JSON.stringify(mx)+', Flow '+flow+', Check '+chk+', Held Fast '+hf+', file '+file);
  assert.ok(mx.peCraze>=2,'real Craze'); assert.ok(mx.peHeat>=3,'real Heat'); assert.ok(chk,'a real Check'); assert.ok(hf,'a real Held Fast'); assert.ok(file,'an ally on his file');
  determinism(H,TEAM);
});

/* The page sites his talents added (the 18 displacement tests that call 'unmoved'; each slam of Worldbreaker Fists, each shockwave hit): with nothing learned, whole
   seeded fights with Pellucid in the line-up are identical to the pre-talent page (ee8edab8), seed by seed, against line-ups that push, pull, knock up and charge;
   and a scripted run in which enemies use every one of those displacements on him is identical too (a draw added at any of those lines changes what follows). */
const BASE_SHA=process.env.TALENT_BASE||'9f1c2762f837a56a68e9315f7c0cab83a9f8ea2f';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-')); TMP.push(dir);
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); return SH.load(path.join(dir,'emberweave-heroes.html')); }
let BASE=null; try{ BASE=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+') - the identity check against it is skipped'); }
/* every displacement of the game used on him by an enemy, one after another, in one scripted fight: each case through doEffect, KonWu's kick, Rivet's hook, the
   Nameless Admiral's every-4th-attack knock, Zahri's stampede, a gear skill's knock; then 80 steps of the fight and the next draw of the seeded stream */
const RS=`(function(al,fo){ ended=false; state='battle'; CUR={mode:'replay',seed:9}; battleTime=0; gameSpeed=1; window._p2win=null; autoUlt=true; try{groundHazards.length=0;shots.length=0;particles.length=0;floatTexts.length=0;}catch(e){} waveXfer=null; chapterWaves=1; waveIdx=0; seedBattle(9); setupMarchTeams(al,fo,false);
    const P=units.find(u=>u.key==='pellucid'), E=units.filter(u=>u.team==='enemy'), e=E[0], M=METER; let n=0; const out=[], cnt=[], ev=()=>(P._tal&&P._tal.s.ev)?P._tal.s.ev.filter(x=>x.slice(0,3)==='um:').length:0;
    const put=(u,dx,dy)=>{ u.x=P.x+dx*M; u.y=P.y+dy*M; u._ax=u.x; u._ay=u.y; }; const far=()=>{ for(const x of units) if(x!==P&&x!==e) put(x,x.team===P.team?-12:30,x.team===P.team?0:12); }; far(); for(let i=0;i<40;i++) updateBattle(SIM_STEP);
    far(); put(e,4.1,0); e.gearSkill={type:'dmg',name:'Knock',used:false,params:{target:'nearest',n:1,mult:0.01,knock:50}}; e.stunned=0; e.fearT=0; const g0=ev(); try{ castGearSkill(e); n++; }catch(x){ out.push('x:gear:'+String(x).slice(0,60)); } cnt.push(ev());
    const pk=e.pass; e.pass=Object.assign({},pk||{},{knock4:true}); e._k4N=3; e.stunned=0; e.atkCd=0; e.target=P; for(let i=0;i<120;i++){ e.x=P.x+4.1*M; e.y=P.y; e._ax=e.x; e._ay=e.y; updateBattle(SIM_STEP); } e.pass=pk; cnt.push(ev()); out.push('k4:'+e._k4N);
    const go=(type,o,tg)=>{ far(); put(e,4.1,0); e.target=tg||P; e._castSlot='green'; e._castLv=100; e._castSM=1; try{ doEffect(e,type,o); n++; }catch(x){ out.push('x:'+type+':'+String(x).slice(0,60)); } finally{ e._castSlot=null; e._castLv=0; } for(let i=0;i<40;i++) updateBattle(SIM_STEP); P.hp=P.maxHp; e.hp=e.maxHp; cnt.push(ev()); };
    go('nova',{mul:0.1,radius:6*M,push:1.5*M}); go('tidalsurge',{mul:0.1,radius:6*M,push:1.6*M}); go('knockstun',{mul:0.1,stun:0.5,push:1.6*M}); go('gravknot',{mul:0.1,radius:6*M,pull:1*M,stun:0.3});
    go('chainquench',Object.assign({},KITS.tolley&&(KITS.tolley.green&&KITS.tolley.green.type==='chainquench'?KITS.tolley.green:KITS.tolley.blue)||{},{mul:0.1})); go('grapple',Object.assign({},KITS.rafe&&(KITS.rafe.green&&KITS.rafe.green.type==='grapple'?KITS.rafe.green:KITS.rafe.blue)||{},{mul:0.1}));
    go('pullsilence',{radius:6*M,dur:1}); go('eventhorizon',Object.assign({},ULT_DEF.eventhorizon,{mul:0.1})); go('gravcrush',Object.assign({},ULT_DEF.gravcrush,{mul:0.1}));
    go('gravsling',Object.assign({},KITS.vulmar.green,{mul:0.1})); go('tendrilpull',{mul:0.1,knockback:1.6*M,dur:1.2,stop:1.2}); go('tendrilpull',Object.assign({},KITS.veyr.green,{mul:0.1}));
    go('charge',Object.assign({},ULT_DEF.charge||{},HERO_ULT_ART.askel||{},{mul:0.1})); go('stampede',Object.assign({},ULT_DEF.stampede,{mul:0.1}));
    far(); put(e,4.1,0); e._kickTg=P; e._kickD0=1e9; e._kickDmg=1; try{ konwuKickExec(e); n++; }catch(x){ out.push('x:kick'); } for(let i=0;i<40;i++) updateBattle(SIM_STEP); cnt.push(ev());
    far(); put(e,4.1,0); try{ rivetHook(e,P); n++; }catch(x){ out.push('x:hook:'+String(x).slice(0,60)); } for(let i=0;i<60;i++) updateBattle(SIM_STEP); cnt.push(ev());
    for(let i=0;i<80;i++) updateBattle(SIM_STEP); return JSON.stringify([n,out,Math.round(P.x),Math.round(P.y),units.map(x=>Math.round(x.hp)),brnd(),cnt]); })`;
const RSN=['gear knock','knock4','nova','tidalsurge','knockstun','gravknot','chainquench','grapple','pullsilence','eventhorizon','gravcrush','gravsling','tendrilpull knock-back','tendrilpull (Veyr)','charge','stampede','kick','hook'];
test('Pellucid: no talents - whole fights with him in the line-up are identical to the pre-talent page, and they reach every site his talents added',{skip:!BASE},()=>{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['pellucid','vael','vireo','sylthaine','gruel'];
  const foes=[['askel','grimsby','absalie','konwu','maren'],['tharl','grosk','vulmar','veyr','rafe'],['brannus','zahri','tolley','rivet','astra']];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>Object.assign(spec(k,70),{skillLv:[60,60,60,60]}))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  let n=0;
  for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
    const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
    assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
  for(const [i,ft] of foes.entries()){ const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(ft.map(k=>Object.assign(spec(k,68),{skillLv:[60,60,60,60]})))));
    for(const seed of [5,77]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed+i));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight '+i+' seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'him on the other side, '+i+' seed '+seed); n+=2; } }
  const scr=h=>{ const al=JSON.stringify(h.snapFromSpecs([spec('pellucid',100),spec('vael',100)])), fo2=JSON.stringify(h.snapFromSpecs([spec('vael',100),spec('vael',100)])); return vm.runInContext(RS+'('+al+','+fo2+')',h.ctx); };
  const ra=scr(NOW); assert.equal(ra,scr(BASE),'a scripted fight with every displacement of the game used on him: identical'); const r=JSON.parse(ra);
  console.log('  identity: '+n+' fights; scripted: '+r[0]+' displacements, '+JSON.stringify(r[1])); assert.ok(r[0]>=17,'every displacement ran'); assert.equal(r[1].filter(x=>x.slice(0,3)!=='k4:').length,0); n++;
  assert.ok(n>=25);
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and a build that sits at that ceiling for more than half a battle is too strong. His damage-reduction
   talents, armor and magic resist, his signature's hold at 1 HP; each candidate build at 91 points legal; the most defensive one is the one whose worst hit is reduced most. */
const DEF={ gc:['gc_3_1','gc_5_3','gc_6_3','gc_12_2','gc_n1','gc_10_3','gc_6_1','gc_13_2','gc_2_3','gc_8_3','gc_3_3'], rk:['rk_4_4','rk_2_4','rk_6_3','rk_8_2','rk_11_4','rk_12_4','rk_10_1','rk_n2','rk_2_2','rk_3_2','rk_n1','rk_1_2','rk_5_4'], fm:['fm_12_3','fm_n1'] };
function defensive(order,caps){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={gc:0,rk:1,fm:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of DEF[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
/* the worst hit on him: every condition of his damage-reduction talents true at once (4 Craze, Hold It Back and the Flow running, 8 Unmoved, an ally on his file,
   a ranged attacker 0.5 m away that he stunned, 4 enemies in Check, below 30% HP, 5 molten layers), measured through the engine (HP and shield it takes) */
function worstHit(list,kind,crit,glyph){ const L=pl(list,{foes:5,allies:1}), {v,F}=L, f=F[0]; v.maxHp=1e5; v.hp=2e4; v.wardenStk=5; v.glyphDR=glyph||0; at(L,L.A[0],-6,0); V.step(1); at(L,L.A[0],-6,0);
  if(L.T){ setStack(L,'peCraze',4); setStack(L,'peUnm',8); openWin(L,'peHold'); openWin(L,'peFlow'); for(const x of F){ setMk(L,x,'peChk',99); setMk(L,x,'peStn',99); } }
  f.melee=false; v.hp=2e4; v.shield=0; v.wardenStk=5; const raw=2e4, x=lost(v,()=>V.hit(f,v,raw,{kind,crit})), cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1; return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Pellucid: his most defensive legal 91-point build never takes more than 95% off a hit, and never sits near that ceiling in a seeded fight',()=>{
  const cands=[[['rk','gc'],[61,30]],[['gc','rk'],[61,30]],[['rk'],[91]],[['gc'],[91]],[['rk','fm'],[61,30]],[['gc','fm'],[61,30]],[['rk','gc','fm'],null]].map(([o,c])=>{ const b=defensive(o,c); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; for(const kind of ['magic','phys']) for(const crit of [false,true]) c.worst=Math.max(c.worst,worstHit(c.list,kind,crit)); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false))), g30=Math.max(...['magic','phys'].map(k=>worstHit(best.list,k,true,0.30)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' worst '+(c.worst*100).toFixed(1)+'%').join(' | '));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.90,'the worst possible hit on his most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 90%');
  VMX('var __dr={max:0,n:0,at:0,hi:0,ticks:0,tHi:0,sum:[],imm:0,stun:{},run:0,runMax:0,tal:0,talOn:0,brk:1e9}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore, __cca=ccApply;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="pellucid"&&src&&src.team!==tgt.team; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive){ const l=h0-tgt.hp-(tgt.shield||0), raw=amt*elemMul(src,tgt); if(raw>0&&l>1e-6*raw&&tgt.hp>1){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    'ccApply=function(u,t,f,d){ const r=__cca.apply(this,arguments); if(r&&u&&u.key==="pellucid"&&f==="stunned") t.__pS=1; return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(u&&u.key==="pellucid"&&u.alive&&u._tal){ __dr.ticks++; if(u._tal.s.undy>0) __dr.imm++; const e=units.find(x=>x.team!==u.team&&x.alive); if(e){ const A=u._tal.s.pe&&u._tal.s.pe.api; if(!A) continue; const k=u._tal.fn.drK(A,u._tal,u,e,"phys",false,false);'+
    '      const tot=1-k*(u.wardenStk?(1-wardenCut(u)):1)*Math.min(defMul(e,u,"phys"),defMul(e,u,"magic")); __dr.sum.push(tot); if(tot>=0.85) __dr.tHi++; } }'+
    '    if(u&&u.team==="enemy"){ const k=u.uid; if(u.alive&&u.stunned>0&&u.__pS){ __dr.stun[k]=(__dr.stun[k]||0)+dt; if(__dr.stun[k]>__dr.runMax) __dr.runMax=__dr.stun[k]; } else { __dr.stun[k]=0; if(!(u.stunned>0)) u.__pS=0; } } } return __ubc.apply(this,arguments); };');
  try{ const sn=snaps(['vael','sylthaine','vireo','meridian','pellucid'].map(k=>Object.assign(spec(k,100,k===H?best.list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['askel','grimsby','konwu','fritz','sloe'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const d=VMX('__dr'), sus=d.sum.slice().sort((x,y)=>x-y), med=sus.length?sus[sus.length>>1]:0;
    console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%, with 30% glyph reduction '+(g30*100).toFixed(1)+'%); seeded fights: '+d.n+' hits, the most reduced '+(d.max*100).toFixed(1)+'%, 85% or more '+d.hi+'; at the ceiling '+d.at+'; probe each tick: median '+(med*100).toFixed(1)+'%, at 85% or more '+d.tHi+' of '+d.ticks+' ticks ('+(100*d.tHi/Math.max(1,d.ticks)).toFixed(1)+'%); held at 1 HP (signature) '+d.imm+' ticks; longest run of one enemy stunned with a stun of his in it '+d.runMax.toFixed(2)+' s');
    assert.ok(d.n>30&&d.ticks>500,'hits on him: '+d.n+', ticks '+d.ticks);
    assert.ok(d.max<0.95,'no hit on him was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0);
    assert.ok(d.hi<0.5*d.n,'above 85% for less than half of the hits'); assert.ok(d.tHi<0.25*d.ticks,'above 85% for well under half of the fight'); assert.ok(d.imm<0.1*d.ticks,'held at 1 HP a small share of the fight'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc; ccApply=__cca;'); }
});

/* the stun-lock rule in seeded fights: every talent stun of his (Throw Them Down, Worldshaker) checked as it lands; the longest time one enemy stays stunned in a row */
test('Pellucid: the stun-lock rule in seeded fights - no talent stun on a stunned enemy or within 0.5 s of his last stun on it; the longest stun chain',()=>{
  const list=S(['fm_2_2','fm_4_2','fm_5_3','fm_1_4','fm_9_4','fm_7_4','fm_12_1','fm_10_2','fm_11_2','fm_1_1','fm_2_1','rk_1_1','rk_9_1']);
  VMX('var __sl={tal:0,bad:0,runMax:0,run:{},gapMin:1e9,end:{}}; var __ubs=_updateBattleCore;'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(!u||u.team!=="enemy") continue; const k=u.uid; if(u.alive&&u.stunned>0){ __sl.run[k]=(__sl.run[k]||0)+dt; if(__sl.run[k]>__sl.runMax) __sl.runMax=__sl.run[k]; } else { if(__sl.run[k]>0) __sl.end[k]=battleTime; __sl.run[k]=0; } } return __ubs.apply(this,arguments); };');
  try{ const sn=snaps(['pellucid','vael','vireo','meridian','gruel'].map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7],[12,5]]) campaign(sn,node,seed);
    const foe=snaps(['askel','grimsby','konwu','fritz','sloe'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const d=VMX('__sl'); console.log('  stun-lock: longest run of one enemy stunned in a row (any stun, his skills included) '+d.runMax.toFixed(2)+' s'); assert.ok(d.runMax>0&&d.runMax<8,'the longest run: '+d.runMax.toFixed(2)); }
  finally{ VMX('_updateBattleCore=__ubs;'); }
  /* the rule itself, on the still field: Throw Them Down and Worldshaker's stuns are tested in their groups; here a stun of his ending 0.3 s before refuses a talent stun */
  const L=pl(S(['fm_2_2','fm_5_3']),{foes:2}); const F0=L.F[0]; free(F0); F0.dmg=1e4; castOn(L,'blue',F0); secs(3.9); F0.stunned=0; setMk(L,F0,'peLk',0.4); secs(0.2); assert.ok(!(F0.stunned>0),'within 0.5 s of his last stun: refused');
});
