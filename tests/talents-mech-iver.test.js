'use strict';
/* Iver's talents as data on the mechanics layer (talents-mech/iver.js), group by group on the still field (tests/talents-lab.js), then whole fights,
   the no-talent identity of the page sites his talents added, Phil's 95% damage-reduction ceiling and the stun-lock rule.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with his talents switched
   off for one action (plainHit) or in a plain lab built BEFORE the talented one: lab() replaces the whole field.
   Places (metres from Iver, centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0) F3 (0,6) F4 (5.5,6) F5 (11,6) F6 (0,12); A0 (0,-5.5) A1 (0,-11). Every lab unit is held.
   STATIC CHARGE builds at the SWING (swing() lets him really swing once) and discharges at the PRESS of a Green or Blue (press() runs the page's castKit, then
   drops the pending cast); its chain strikes the first living enemies in the field's own order (F0, F1, F2 ...).
   Run: node --test tests/talents-mech-iver.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,full,everything,accounting,determinism,snaps,spec,campaign,build,root}=require('./talents-lab.js');
const H='iver', S=ids=>full(H,ids);
test.afterEach(()=>{ FX.define(H,null); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const VMX=s=>vm.runInContext(s,NOW.ctx);
const plain=(o,fn)=>fn(lab(H,null,o));
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{},{n,t:99,idle:0}); };
const win=(L,name)=>{ const w=L.T.s.w[name]; return !!w&&w.t>0; };
const setWin=(L,name,t)=>{ L.T.s.w[name]={t:t==null?99:t,n:1,cdT:0,at:-1,wave:false}; };
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const hitOn=(L,t,amt,o)=>lost(t,()=>V.hit(o&&o.src||L.F[0],t,amt||1000,Object.assign({kind:'true'},o||{})));
const mine=(L,t,amt,o)=>lost(t,()=>V.hit(L.v,t,amt||1000,Object.assign({kind:'true'},o||{})));
const EL=VMX('(s,t)=>elemMul(s,t)'), DEF=VMX('(s,t,k)=>defMul(s,t,k)'), KIT=VMX('(u,ab)=>castKit(u,ab)'), SKM=VMX('(l)=>skillMul(l)');
const atk=v=>v.dmg*((v.dmgBuffT>0)?(v.dmgBuffMul||1):1)*VMX('rageMul');
const free=x=>{ x.stunned=0; x.level=1; };
const press=(L,slot)=>{ const v=L.v; KIT(v,slot==='blue'?v.blueAb:v.greenAb); v._pend=null; v._castT=0; };
const chainX=(v,f)=>0.55*(v.apow||v.dmg)*(v.passMul||1)*DEF(v,f,'magic');          // one chain hit as the page deals it (through the target's magic resist)
const setCh=(L,n)=>{ if(L.T) L.T.s.ivC=n; L.v._scStk=n; L.v._scReady=n>=5?1:0; };
const setStr=(L,n)=>{ L.T.s.ivSt=n; setStack(L,'iv_str',Math.min(12,n)); };
const hasM=(L,t,name)=>{ const o=t._talM&&t._talM[L.v.uid], m=o&&o[name]; return !!m&&(m.until==null||V.now()<m.until); };
const putM=(L,t,name,s)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o[name]={t0:V.now(),until:V.now()+(s||99),v:0}; };
const delM=(L,t,name)=>{ const o=t._talM&&t._talM[L.v.uid]; if(o) delete o[name]; };
const losses=(F,fn)=>{ const h=F.map(f=>f.hp+(f.shield||0)); fn(); return F.map((f,i)=>h[i]-f.hp-(f.shield||0)); };
const sum=a=>a.reduce((x,y)=>x+y,0);
const POS=[[4.5,0],[10,0],[15.5,0],[0,6],[5.5,6],[11,6],[0,12],[5.5,12],[11,12]];
const home=L=>L.F.forEach((f,i)=>at(L,f,POS[i][0],POS[i][1]));
/* a real swing: he is let go for one swing at F[i] (placed in reach), then held again; Static Charge builds at the swing */
function swing(L,i){ const v=L.v, f=L.F[i==null?0:i]; at(L,f,V.bodyR(v)+V.bodyR(f)+0.15,0); v.stunned=0; v.greenCd=v.blueCd=1e9; v.energy=0; v.target=f; v.atkCd=0; v.attackAnim=0; v._castT=0; v._recentAtk=0; v._ax=v.x; v._ay=v.y;
  let k=0; for(;k<90&&!(v.attackAnim>0);k++) V.step(1); v.stunned=1e6; v.atkCd=1e9; assert.ok(k<90,'he swung'); return f; }
/* the blow of that swing lands later (its fuse): let him go until it has */
function blow(L,i){ const v=L.v, f=L.F[i==null?0:i], h=f.hp; swing(L,i); v.stunned=0; v.atkCd=1e9; let k=0; for(;k<120&&!(f.hp<h);k++) V.step(1); v.stunned=1e6; assert.ok(f.hp<h,'the blow landed'); }
/* Thunder Guard's 5 s run in his own think, which a held unit skips: let him go (doing nothing) until it ends, then hold him again; returns how long it took */
function guardOut(L,keepCd){ const v=L.v, t0=V.now(); v.stunned=0; v.atkCd=1e9; v.greenCd=1e9; if(!keepCd) v.blueCd=1e9; v.energy=0; v.energyReg=0; const sp=v.speed; v.speed=0;
  let k=0; for(;k<400&&(v._thornT||0)>0;k++){ v.energy=0; V.step(1); } v.stunned=1e6; v.speed=sp; assert.ok(!((v._thornT||0)>0),'Thunder Guard ended'); return V.now()-t0; }
/* an enemy ability aimed at that ally (the page's _talAim), landing now: does the Rod draw it? */
const aimHit=(L,src,a,amt,o)=>{ src._talAim={t:a,at:V.now(),area:!!(o&&o.area)}; return lost(a,()=>V.hit(src,a,amt||1000,Object.assign({kind:'true'},o||{}))); };
function drawOne(L,src,a){ for(let k=0;k<80;k++) if(aimHit(L,src,a,1000)===0) return true; return false; }

test('Iver: every talent is accounted for - 10 plain stats, 108 with rows, none waiting',()=>{
  accounting(H,[118,10,108,0,0]);
  for(const id of ['ts_1_1','lr_1_1','sf_1_1','ts_13_2','lr_13_2','sf_13_2','ts_4_3']) assert.ok(FXN.mech(H).talents[id],id);
  for(const id of ['ts_1_3','ts_8_1','ts_8_3','lr_1_2','lr_4_1','lr_5_1','sf_1_3','sf_3_3','sf_8_1','sf_8_3']) assert.ok(FXN.has(H,id),id+' is a plain stat');
  assert.ok(!FXN.has(H,'ts_4_3'),'Ozone is in his crit group (5% in all), not a plain stat');
});

test('Iver: his real kit, as the talents read it - Static Charge (swing, press, chain), Volt Pike, Thunder Guard, Skybreak (1.4 s)',()=>{
  plain({foes:4},P=>{ const {v,F}=P; assert.ok(v.pass&&v.pass.staticcharge,'his passive Static Charge');
    v._scStk=3; swing(P,3); assert.equal(v._scStk,4,'a swing builds 1 Charge'); swing(P,3); assert.equal(v._scStk,5); assert.equal(v._scReady,1,'ready at 5'); swing(P,3); assert.equal(v._scStk,5,'never past 5');
    home(P); const l=losses(F,()=>press(P,'blue')); for(let i=0;i<3;i++) near(l[i],chainX(v,F[i]),'the press discharges: 55% of his ability power (he has some) x passive strength, magic, on enemy '+i);
    assert.equal(l[3],0,'the first 3 living enemies in the field\'s order only'); assert.equal(v._scStk,0); assert.equal(v._scReady,0);
    console.log('  kit: a chain hit is '+(0.55*(v.apow||v.dmg)*(v.passMul||1)).toFixed(1)+' before resist = '+(0.55*(v.apow||v.dmg)*(v.passMul||1)/v.dmg).toFixed(2)+' x his Attack (ability power '+Math.round(v.apow)+', Attack '+Math.round(v.dmg)+')');
    assert.ok(losses(F,()=>press(P,'blue')).every(x=>Math.abs(x)<1e-9),'not ready: no chain');
    const sm=SKM(10), vp=losses(F,()=>V.cast(v,'green')); for(let i=0;i<3;i++) near(vp[i],v.dmg*1.5*sm*VMX('rageMul')*DEF(v,F[i],'phys'),'Volt Pike: 150% x skill level on every enemy on its line to the farthest'); assert.equal(vp[3],0,'not one off the line');
    V.cast(v,'blue'); near(v.shield,v.maxHp*0.18*sm,'Thunder Guard: a shield of 18% x skill level'); near(v._thornT,5,'for 5 s',1e-9);
    near(lost(F[0],()=>V.hit(F[0],v,100,{kind:'true'})),v.dmg*Math.min(0.85,0.6*sm)*DEF(v,F[0],'phys'),'every hit on him answered: his attack x 0.6 x skill level (at most 85%)');
    for(const f of F) free(f); at(P,F[1],4.5,3); const sb=losses(F,()=>V.cast(v,'ult',F[0])); assert.ok(sb[0]>0&&sb[1]>0,'Skybreak strikes around its target'); assert.equal(sb[2],0);
    near(F[0].stunned,1.4,'Skybreak\'s stun lands at 1.4 s (the table\'s 2.0 s area stun x 0.7) - the card line says 2 s',1e-9);
  });
});

/* ============================== THE TWELFTH STRIKE ============================== */
test('Iver / Charge: Overfull past five to 8 (its chain 4% x 3 more per Charge above five), Live Wire, Quick Charge, Static Hair, Copper Skin',()=>{
  const L=lab(H,S(['ts_1_4','ts_12_3','ts_6_4','ts_11_4']),{foes:4,big:true}), {v,F}=L;
  setCh(L,4); V.step(2); const s1=v.speed; setCh(L,5); V.step(2); near(v.speed,s1*1.06,'Static Hair: at 5 Charge he moves 3% x 2 faster');
  setCh(L,8); near(hitOn(L,v,1000),1000*(1-0.004*5*5),'Copper Skin: 0.4% x 5 per Charge, up to 5'); setCh(L,0); near(hitOn(L,v,1000),1000,'no Charge: nothing');
  setCh(L,4); swing(L,3); assert.equal(v._scStk,8,'Live Wire: the first swing of the wave builds 2 x 2 = 4 (4 + 4 = 8, Overfull\'s top)'); assert.equal(v._scReady,1);
  setCh(L,5); swing(L,3); assert.equal(v._scStk,6,'a later swing: 1'); swing(L,3); swing(L,3); swing(L,3); assert.equal(v._scStk,8,'held at 8');
  home(L); const l=losses(F,()=>press(L,'green')); near(l[0],chainX(v,F[0])*(1+0.04*3*3),'Overfull: 3 above five, 4% x 3 each'); assert.equal(v._scStk,0);
  setCh(L,6); near(losses(F,()=>press(L,'green'))[0],chainX(v,F[0])*(1+0.04*3),'1 above five'); setCh(L,5); near(losses(F,()=>press(L,'green'))[0],chainX(v,F[0]),'none above five');
  V.wave(); V.step(1); setCh(L,4); swing(L,3); assert.equal(v._scStk,8,'Live Wire again in a new wave');
  const Q=lab(H,S(['ts_2_2']),{foes:4,big:true}); let two=0; for(let i=0;i<60;i++){ setCh(Q,0); swing(Q,3); if(Q.v._scStk===2) two++; else assert.equal(Q.v._scStk,1); }
  assert.ok(two>=3&&two<=25,'Quick Charge: 4% x 5 of swings build 2 (the fight\'s seeded stream): '+two+' of 60');
});

test('Iver / the discharge: Held Current, Bright Arc, Eleventh Hour, Storm Season, Afterglow, Looking Forward, Thunder Coat, Charge Echo',()=>{
  const L=lab(H,S(['ts_1_4','ts_2_4','ts_3_4','ts_12_2','ts_10_1','ts_10_4','ts_11_2','ts_n1','ts_12_4']),{foes:7,big:true}), {v,F}=L;
  setCh(L,7); const l=losses(F,()=>press(L,'blue')), k=1+0.04*3*2;
  for(let i=0;i<5;i++) assert.ok(l[i]>0,'Held Current: 2 above five reach 2 more (5): enemy '+i); assert.equal(l[5],0); assert.equal(l[6],0);
  near(l[0],chainX(v,F[0])*k,'the first: no Bright Arc'); near(l[1],chainX(v,F[1])*k*1.10,'Bright Arc: each one after the first 2% x 5 more'); near(l[4],chainX(v,F[4])*k*1.10);
  assert.equal(v._scStk,3,'Charge Echo: keeps 1 x 3'); assert.ok(win(L,'iv_ag'),'Afterglow window'); assert.equal(stack(L,'iv_lf'),1,'Looking Forward: 1');
  near(v.shield,v.maxHp*0.05,'Thunder Coat: a shield of 1% x 5 of his max HP',1e-9); near(v.shieldT,3,'for 3 s',1e-9);
  near(hitOn(L,v,1000),1000*(1-0.075),'Afterglow: 1.5% x 5 less for 3 s'); secs(3.1); near(hitOn(L,v,1000),1000,'then not'); assert.equal(stack(L,'iv_lf'),1); secs(1); assert.equal(stack(L,'iv_lf'),0,'Looking Forward lapses 4 s after the last');
  setCh(L,5); v.greenCd=5; press(L,'blue'); near(v.greenCd,5,'Storm Season waits until the press has set its cooldown',1e-9); V.step(1); near(v.greenCd,4,'then 0.2 x 5 s off Volt Pike\'s cooldown',1e-9);
  v.greenCd=0.3; setCh(L,5); press(L,'blue'); V.step(1); assert.equal(v.greenCd,0,'never below 0');
  for(let i=0;i<3;i++){ setCh(L,5); press(L,'blue'); } assert.equal(stack(L,'iv_lf'),3,'Looking Forward: up to 3'); V.step(1); const a3=v.atkInterval; L.T.s.k.iv_lf.n=0; V.step(1); near(a3*1.15,v.atkInterval,'1% x 5 attack speed each');
  setStr(L,10); setCh(L,5); const e10=losses(F,()=>press(L,'blue')); setStr(L,11); setCh(L,5); const e11=losses(F,()=>press(L,'blue')); near(e11[0],e10[0]*1.15,'Eleventh Hour: at 11 Strikes the chain 3% x 5 more');
});

test('Iver / Strikes: Struck Once (max 12 a fight), White at the Fourth, After the Seventh, Eleven Times, Twelve Counted',()=>{
  const p=plain({},P=>P.v.dmg), L=lab(H,S(['ts_1_1','ts_2_1','ts_3_1','ts_4_1','ts_9_4','ts_1_4','ts_2_4']),{foes:7,big:true}), {v,F}=L;
  for(let i=0;i<14;i++){ setCh(L,5); press(L,'blue'); } assert.equal(L.T.s.ivSt,12,'each discharge is a Strike, at most 12 a fight'); assert.equal(stack(L,'iv_str'),12);
  V.step(1); near(v.dmg,p*(1+0.003*5*12),'Struck Once: 0.3% x 5 attack per Strike');
  near(hitOn(L,v,1000),1000*(1-0.002*5*12),'Eleven Times: 0.2% x 5 damage reduction per Strike');
  setStr(L,3); V.step(1); const a3=v.atkInterval; setStr(L,4); V.step(1); near(a3,v.atkInterval*1.06,'White at the Fourth: at 4 Strikes 2% x 3 faster');
  setStr(L,6); setCh(L,3); swing(L,6); assert.equal(v._scStk,4); assert.equal(v._scReady,0,'6 Strikes: ready at 5'); setStr(L,7); setCh(L,3); swing(L,6); assert.equal(v._scStk,4); assert.equal(v._scReady,1,'After the Seventh: at 7 Strikes ready at 4');
  home(L); setStr(L,11); setCh(L,5); const n11=losses(F,()=>press(L,'blue')); assert.equal(n11.filter(x=>x>0).length,3,'5 Charge: 3 enemies'); near(n11[0],chainX(v,F[0]));
  setStr(L,12); setCh(L,5); const n12=losses(F,()=>press(L,'blue')); assert.equal(n12.filter(x=>x>0).length,6,'Twelve Counted: at 12 Strikes as if he held 8 (Held Current: 3 more)'); near(n12[0],chainX(v,F[0])*1.36,'(and Overfull\'s 4% x 3 for each of the 3)');
});

test('Iver / more Charge: Charged Pike, Charged Throw, Bracing Charge, Charged Skin; Quiet Weeks',()=>{
  const L=lab(H,S(['ts_4_2','sf_12_3','ts_11_1']),{foes:3,big:true}), {v,F}=L; assert.equal(v._scStk,3,'Quiet Weeks: he starts the wave with at least 3');
  setCh(L,0); V.cast(v,'green'); assert.equal(v._scStk,5,'Volt Pike through 3 enemies: Charged Pike 1 each (up to 3), Charged Throw 1 x 2');
  setCh(L,0); at(L,F[1],4.5,8); at(L,F[2],4.5,-8); V.cast(v,'green'); assert.equal(v._scStk,1+2,'one enemy on its line: 1 + 2');
  setCh(L,1); V.wave(); V.step(1); assert.equal(v._scStk,3,'Quiet Weeks: at least 3 again');
  const B=lab(H,S(['ts_9_3','ts_1_4']),{foes:2,big:true}); setCh(B,0); V.cast(B.v,'blue'); for(let i=0;i<9;i++) V.hit(B.F[0],B.v,1,{kind:'true'}); assert.equal(B.v._scStk,5,'Bracing Charge: each retaliation 1, up to 1 x 5 a cast');
  V.cast(B.v,'blue'); V.hit(B.F[0],B.v,1,{kind:'true'}); assert.equal(B.v._scStk,6,'a new Thunder Guard: more');
  const C=lab(H,S(['lr_12_3','ts_1_4']),{foes:2,big:true}); setCh(C,0); for(let i=0;i<30;i++) V.hit(C.F[0],C.v,1,{kind:'true'}); assert.ok(C.v._scStk>=2&&C.v._scStk<=8,'Charged Skin: 10% x 2 of the hits he takes build 1: '+C.v._scStk+' from 30');
});

test('Iver / Hold It In (PICK ONE) and Gathering Sky: the press keeps the charge, Skybreak takes it and chains to 5',()=>{
  const p=plain({foes:6},P=>{ for(const f of P.F) free(f); return losses(P.F,()=>V.cast(P.v,'ult',P.F[0])); }), L=lab(H,S(['ts_5_2','ts_6_2']),{foes:6,big:true}), {v,F}=L; for(const f of F) free(f);
  setCh(L,5); assert.ok(losses(F,()=>press(L,'blue')).every(x=>Math.abs(x)<1e-9),'the press does not discharge'); assert.equal(v._scReady,1,'the charge is kept');
  const l=losses(F,()=>V.cast(v,'ult',F[0])); near(l[0],chainX(v,F[0])+p[0]*1.15,'Skybreak takes the discharge, and Gathering Sky: 3% x 5 more');
  for(let i=1;i<5;i++) near(l[i],chainX(v,F[i])+p[i]*1.15,'the chain reaches 5: enemy '+i); near(l[5],p[5]*1.15,'not a 6th'); assert.equal(v._scReady,0);
  for(const f of F) f.stunned=0; near(lost(F[0],()=>V.cast(v,'ult',F[0])),p[0]*1.15,'no charge: Skybreak alone');
});

test('Iver / Let It Go (PICK ONE) and Crackling Spear: at a full charge his next basic attack also chains to 2 enemies',()=>{
  const L=lab(H,S(['ts_5_3','ts_6_3']),{foes:4,big:true}), {v,F}=L; setCh(L,5);
  const h=F.map(f=>f.hp); blow(L,0); const d=F.map((f,i)=>h[i]-f.hp); const E=VMX('(a,b)=>dist(a,b)');
  const ord=[1,2,3].sort((a,b)=>E(F[0],F[a])-E(F[0],F[b])); near(d[ord[0]],chainX(v,F[ord[0]])*1.18,'the 2 nearest to its target: Crackling Spear 6% x 3 more'); near(d[ord[1]],chainX(v,F[ord[1]])*1.18); assert.equal(d[ord[2]],0);
  assert.equal(v._scReady,1,'the charge is still there for the ability'); const h2=F[ord[0]].hp; blow(L,0); near(F[ord[0]].hp,h2,'once per charge-up',1e-12);
  press(L,'blue'); setCh(L,3); const h3=F[ord[0]].hp; blow(L,0); near(F[ord[0]].hp,h3,'not ready: nothing',1e-12); setCh(L,5); const h4=F[ord[0]].hp; blow(L,0); assert.ok(F[ord[0]].hp<h4,'a new charge-up: again');
});

test('Iver / Forked Pike and Every Line Lit: a Volt Pike pressed with a discharge chains again from every other enemy it pierces',()=>{
  const p=plain({foes:6},P=>losses(P.F,()=>V.cast(P.v,'green'))), L=lab(H,S(['ts_7_2','ts_9_2']),{foes:6,big:true}), {v,F}=L; assert.ok(p[0]>0&&p[1]>0&&p[2]>0&&p[3]===0);
  setCh(L,5); press(L,'green'); const l=losses(F,()=>V.cast(v,'green'));
  near(sum(l),sum(p)+2*3*chainX(v,F[0])*1.15,'2 more chains of 3 (from the 2nd and 3rd enemy pierced), Every Line Lit 3% x 5 more');
  near(sum(losses(F,()=>V.cast(v,'green'))),sum(p),'a Volt Pike with no discharge: none');
  setCh(L,5); press(L,'blue'); near(sum(losses(F,()=>V.cast(v,'green'))),sum(p),'a discharge pressed on Thunder Guard: none');
});

test('Iver / Charged Air and the stun-lock rule; Storm-Worn',()=>{
  const L=lab(H,S(['ts_7_4','ts_3_3']),{foes:4,big:true}), {v,F}=L; for(const f of F) free(f);
  setCh(L,5); press(L,'blue'); for(let i=0;i<3;i++) near(F[i].stunned,0.3,'Charged Air: every chained enemy stunned 0.06 x 5 s (its full written time)',1e-9); assert.equal(F[3].stunned,0);
  setCh(L,5); press(L,'blue'); near(F[0].stunned,0.3,'never on an enemy that is stunned',1e-9);
  secs(0.35); assert.ok(!(F[0].stunned>0)); setCh(L,5); press(L,'blue'); assert.ok(!(F[0].stunned>0),'nor within 0.5 s after his stun on it ended');
  secs(0.35); setCh(L,5); press(L,'blue'); assert.ok(!(F[0].stunned>0),'(0.4 s after: still not)'); secs(0.15); setCh(L,5); press(L,'blue'); near(F[0].stunned,0.3,'then again',1e-9);
  F[1].stunned=0.1; delM(L,F[1],'iv_lk'); setCh(L,5); press(L,'blue'); near(F[1].stunned,0.1,'not even on a stun that is not his',1e-9);
  near(hitOn(L,v,1000,{src:F[0]}),900,'Storm-Worn: an enemy his chain struck deals 2% x 5 less to him'); near(hitOn(L,v,1000,{src:F[3]}),1000,'not one it did not'); secs(3.1); near(hitOn(L,v,1000,{src:F[0]}),1000,'for 3 s');
});

test('Iver / Overflowing: each Charge above five heals him 1% x 3 at the discharge, inside the regeneration cap (1.2% of his max HP for each second)',()=>{
  const L=lab(H,S(['ts_1_4','ts_5_4']),{foes:3,big:true}), {v}=L; v.hp=v.maxHp*0.5; secs(15);
  let h=v.hp; setCh(L,8); press(L,'blue'); near((v.hp-h)/v.maxHp,0.09,'3 above five: 9% (the budget holds at most 10 s: 12%)',1e-6);
  h=v.hp; setCh(L,8); press(L,'blue'); near((v.hp-h)/v.maxHp,0.03,'at once again: only the 3% left',1e-3);
  secs(2); h=v.hp; setCh(L,6); press(L,'blue'); near((v.hp-h)/v.maxHp,0.024,'2 s later: 1.2% x 2 (it asked for 3%)',2e-2);
});

test('Iver / The Twelfth Is Owed (SIGNATURE): Strikes past 12; every 6th calls Skybreak down on the enemy with the most HP, every 12th three times as hard with a 3 s stun',()=>{
  const L=lab(H,S(['ts_13_2','ts_1_1']),{foes:4,big:true}), {v,F}=L; for(const f of F) free(f); F[3].maxHp=2e9; F[3].hp=2e9;
  const raw=()=>atk(v)*SKM(10)*1.4;
  setStr(L,5); setCh(L,5); let x=raw(); const l=losses(F,()=>press(L,'blue')); assert.equal(L.T.s.ivSt,6);
  near(l[3],x*DEF(v,F[3],'phys'),'the 6th: Skybreak on the enemy with the most HP, through its armor'); near(F[3].stunned,1.5,'stunned 1.5 s',1e-9);
  near(l[0],chainX(v,F[0])+0.5*x*DEF(v,F[0],'phys'),'every other enemy: half (beside the chain itself)');
  F[3].stunned=0; delM(L,F[3],'iv_lk'); setStr(L,11); setCh(L,5); press(L,'blue'); assert.equal(stack(L,'iv_str'),12);
  setCh(L,5); press(L,'blue'); assert.equal(L.T.s.ivSt,13,'counted past 12'); F[3].stunned=0; delM(L,F[3],'iv_lk');
  setStr(L,11); setCh(L,5); x=raw(); const l2=losses(F,()=>press(L,'blue')); near(l2[3],3*x*DEF(v,F[3],'phys'),'the 12th: three times its damage'); near(F[3].stunned,3,'and a 3 s stun, in full',1e-9);
  F[3].stunned=0; delM(L,F[3],'iv_lk'); setStr(L,16); setCh(L,5); const h=F[3].hp; press(L,'blue'); near(F[3].hp,h,'the 17th: nothing',1e-12);
  setCh(L,5); x=raw(); near(losses(F,()=>press(L,'blue'))[3],x*DEF(v,F[3],'phys'),'the 18th: Skybreak'); assert.equal(stack(L,'iv_str'),12,'the bonuses stop at 12');
});

/* ============================== VOLT PIKE ============================== */
test('Iver / Volt Pike: Grounding Spear, Straight Line, Line of Storms (per enemy pierced), Wet Ground, Long Watch for Storms (at most 10%), Weather Eye, Thrown Far (wider)',()=>{
  const p=plain({foes:3},P=>({l:losses(P.F,()=>V.cast(P.v,'green')),d:P.v.dmg})), L=lab(H,S(['ts_10_3','sf_2_2','sf_12_2','sf_n1','sf_11_2','sf_10_3']),{foes:3,big:true}), {v,F}=L;
  const l=losses(F,()=>V.cast(v,'green')); for(let i=0;i<3;i++) near(l[i],p.l[i]*1.12*1.15*1.15,'4% x 3, 3% x 5, Line of Storms 1% x 5 for each of the 3 pierced: enemy '+i);
  near(F[0].slowMul,0.80,'Wet Ground: slowed 4% x 5',1e-9); near(F[0].slow,2,'for 2 s',1e-9);
  V.step(1); near(v.dmg,p.d*1.06,'Long Watch: 0.4% x 5 attack for each enemy pierced this wave'); V.cast(v,'green'); V.step(1); near(v.dmg,p.d*1.10,'at most 10%');
  V.wave(); V.step(2); near(v.dmg,p.d,'gone at the next wave');
  near(FX.cd(v,'green',7),6,'Weather Eye: 0.2 x 5 s shorter',1e-9);
  const W=lab(H,S(['sf_4_2']),{foes:3}), M=V.METER; near(FX.kit(W.v,'piercethrow',{width:34*1.15}).width,34*1.15+0.6*M,'Thrown Far: its line 0.2 m x 3 wider (a longer line would add nobody: it aims at the farthest enemy)',1e-9);
  at(W,W.F[1],10,1.6); assert.equal(plainHit(W,()=>lost(W.F[1],()=>V.cast(W.v,'green'))),0,'1.6 m off its line: missed'); assert.ok(lost(W.F[1],()=>V.cast(W.v,'green'))>0,'with Thrown Far: struck');
});

test('Iver / Pike and Return (PICK ONE) with Rapid Throws; Pinned by Lightning (PICK ONE) with Held in Light',()=>{
  const R=lab(H,S(['sf_5_2','sf_6_2']),{foes:2}); near(FX.cd(R.v,'green',7),5,'Pike and Return: 2 s shorter',1e-9);
  const a0=R.v.atkInterval; V.cast(R.v,'green'); V.step(1); near(a0,R.v.atkInterval*1.05,'Rapid Throws: 1% x 5 attack speed'); secs(3.1); near(R.v.atkInterval,a0,'for 3 s');
  const L=lab(H,S(['sf_5_3','sf_6_3']),{foes:3,big:true}), {v,F}=L; const s0=F[0].speed; V.cast(v,'green'); V.step(1); assert.equal(F[0].speed,0,'Pinned by Lightning: every enemy it pierced cannot move');
  near(mine(L,F[0],1000),1090,'Held in Light: 3% x 3 more from Iver on a rooted enemy'); secs(1.1); near(F[0].speed,s0,'for 1 s',1e-9); near(mine(L,F[0],1000),1000,'then not');
});

/* ============================== LIT ============================== */
test('Iver / Lit: Lit End to End (the arc), Current Jumps, Arc Flash, Bright Line, Long Light, Conductor, Lit From Within, Appointment Kept',()=>{
  const p=plain({},P=>P.v.dmg), L=lab(H,S(['sf_1_1','sf_2_1','sf_3_1','sf_6_1','sf_4_1','sf_10_1','sf_12_1','sf_11_1']),{foes:4,allies:1,big:true}), {v,A,F}=L;
  V.cast(v,'green'); for(let i=0;i<3;i++) assert.ok(hasM(L,F[i],'iv_lit'),'Volt Pike leaves every enemy it pierced Lit'); assert.ok(!hasM(L,F[3],'iv_lit'));
  V.step(1); near(v.dmg,p*(1+0.005*5*3),'Conductor: 0.5% x 5 attack for each Lit enemy');
  const l=losses(F,()=>V.hit(v,F[0],1000,{kind:'true'})); near(l[0],1100,'Bright Line: 2% x 5 more on a Lit enemy');
  near(l[1],1100*0.30*1.12,'the arc: 6% x 5 of the hit to the nearest other Lit enemy (Arc Flash: 4% x 3 more)'); near(l[2],1100*0.30*1.12,'Current Jumps: on to a third'); assert.equal(l[3],0);
  near(hitOn(L,A[0],1000,{src:F[0]}),940,'Lit From Within: a Lit enemy deals 2% x 3 less to his allies'); near(hitOn(L,v,1000,{src:F[0]}),940,'and to him'); near(hitOn(L,v,1000,{src:F[3]}),1000,'not an unlit one');
  secs(3); V.dmg(F[1],1e12); assert.ok(!F[1].alive); secs(5.4-0.05); assert.ok(hasM(L,F[0],'iv_lit'),'Appointment Kept: a Lit enemy died, every other Lit enemy is Lit again for the full 4 + 0.5 x 3 s'); secs(0.3); assert.ok(!hasM(L,F[0],'iv_lit'),'Long Light: 5.5 s');
});

test('Iver / The Cloud Answers (SIGNATURE): a Volt Pike with 6 Thunderhead steps calls Skybreak down on every enemy it pierced, 1.5 s stuns, Lit and arcing 6 s; once every 25 s',()=>{
  const p=plain({foes:3},P=>losses(P.F,()=>V.cast(P.v,'green'))), L=lab(H,S(['sf_13_2']),{foes:3,big:true}), {v,F}=L; for(const f of F) free(f); setStack(L,'iv_th',6);
  const x=atk(v)*SKM(10)*1.4, l=losses(F,()=>V.cast(v,'green')); for(let i=0;i<3;i++){ near(l[i],p[i]+x*DEF(v,F[i],'phys'),'Skybreak at full damage on enemy '+i); near(F[i].stunned,1.5,'stunned 1.5 s',1e-9); assert.ok(hasM(L,F[i],'iv_lit')); }
  assert.equal(stack(L,'iv_th'),6,'the steps are not spent');
  const a=losses(F,()=>V.hit(v,F[0],1000,{kind:'true'})); near(a[1],300,'they arc to one another (30% without Lit End to End)'); secs(5.9); assert.ok(hasM(L,F[0],'iv_lit')); secs(0.2); assert.ok(!hasM(L,F[0],'iv_lit'),'for 6 s');
  near(sum(losses(F,()=>V.cast(v,'green'))),sum(p),'once every 25 s'); secs(14.5); { const q0=plainHit(L,()=>sum(losses(F,()=>V.cast(v,'green')))); near(sum(losses(F,()=>V.cast(v,'green'))),q0,'not at 20 s'); } secs(4.5); const q=plainHit(L,()=>sum(losses(F,()=>V.cast(v,'green')))), y=atk(v)*SKM(10)*1.4;
  near(sum(losses(F,()=>V.cast(v,'green'))),q+sum(F.map(f=>y*DEF(v,f,'phys'))),'25 s later: again',1e-6);
});

/* ============================== THE THUNDERHEAD AND SKYBREAK ============================== */
test('Iver / Thunderhead: Still Days, Storm Front, Heavy Sky, Rain Before, Black Cloud; Gathering Cloud spends the steps, Thunder Rolls keeps some; Low Cloud',()=>{
  const p=plain({foes:2},P=>{ free(P.F[0]); return lost(P.F[0],()=>V.cast(P.v,'ult',P.F[0])); }), L=lab(H,S(['sf_1_4','sf_2_4','sf_5_4','sf_6_4','sf_7_4','sf_10_4','sf_12_4']),{foes:2,big:true}), {v,F}=L;
  assert.equal(stack(L,'iv_th'),3,'Still Days: 1 x 3 steps at the wave\'s start'); secs(2.7); assert.equal(stack(L,'iv_th'),3); secs(0.2); assert.equal(stack(L,'iv_th'),4,'Storm Front: a step every 4 - 0.4 x 3 = 2.8 s');
  setStack(L,'iv_th',2); V.step(1); const a2=v.atkInterval; setStack(L,'iv_th',6); V.step(1); near(a2,v.atkInterval*(1+0.015*6)/(1+0.015*2),'Heavy Sky: 0.5% x 3 attack speed per step');
  near(hitOn(L,v,1000),1000*(1-0.01*6),'Rain Before: 0.5% x 2 less per step'); near(mine(L,F[0],1000,{auto:true}),1100,'Black Cloud: at 6 steps his basic attacks 2% x 5 more'); setStack(L,'iv_th',5); near(mine(L,F[0],1000,{auto:true}),1000,'not at 5');
  free(F[0]); setStack(L,'iv_th',6); near(lost(F[0],()=>V.cast(v,'ult',F[0])),p*(1+0.04*3*6),'Gathering Cloud: Skybreak 4% x 3 more per step'); assert.equal(stack(L,'iv_th'),3,'it spends them, Thunder Rolls keeps 1 x 3');
  const W=lab(H,S(['sf_3_4']),{foes:2}); near(FX.kit(W.v,'aoeStun',{radius:100}).radius,115,'Low Cloud: its radius 3% x 5 larger',1e-9);
});

test('Iver / Skyward Spear and Every Light Struck: Skybreak falls on every Lit enemy at 40% with half the stun; Cloudburst; Hard Rain',()=>{
  const p=plain({foes:4},P=>{ for(const f of P.F) free(f); return losses(P.F,()=>V.cast(P.v,'ult',P.F[0])); }), L=lab(H,S(['sf_7_2','sf_9_2','sf_9_4','sf_1_4','sf_9_3']),{foes:4,big:true}), {v,F}=L; for(const f of F) free(f);
  putM(L,F[0],'iv_lit'); putM(L,F[2],'iv_lit'); setStack(L,'iv_th',0); const l=losses(F,()=>V.cast(v,'ult',F[0]));
  near(l[0],p[0]*0.4*1.15,'every Lit enemy: 40%, Every Light Struck 3% x 5 more'); near(l[2],p[0]*0.4*1.15*DEF(v,F[2],'phys')/DEF(v,F[0],'phys'),'wherever it stands'); assert.equal(l[1],0); assert.equal(l[3],0);
  near(F[0].stunned,0.7,'half the stun: 0.7 s',1e-9); near(F[2].stunned,0.7,'',1e-9); assert.ok(win(L,'iv_hr'),'Hard Rain: 4 s after Skybreak');
  for(const f of F){ free(f); delM(L,f,'iv_lit'); delM(L,f,'iv_lk'); } L.T.s.w.iv_hr.t=0; setStack(L,'iv_th',6); const n=losses(F,()=>V.cast(v,'ult',F[0])); near(n[0],p[0]*(1+0.12*6),'no Lit enemy: Skybreak as it is (Gathering Cloud)'); near(F[0].stunned,1.4,'',1e-9);
  assert.ok(hasM(L,F[0],'iv_lit'),'Cloudburst: it spent 6 steps - every enemy it stunned is Lit');
  for(const f of F){ free(f); delM(L,f,'iv_lit'); } setStack(L,'iv_th',5); V.cast(v,'ult',F[0]); assert.ok(!hasM(L,F[0],'iv_lit'),'not at 5');
});

/* ============================== LIGHTNING ROD ============================== */
test('Iver / the Rod: Tallest Thing, Draw the Storm (doubled, 2 m), Every Storm Comes Here; only single-target abilities aimed at an ally near him',()=>{
  const L=lab(H,S(['lr_1_1']),{foes:2,allies:2,big:true}), {v,A,F}=L; at(L,A[0],0,-5); let n=0;
  for(let i=0;i<200;i++) if(aimHit(L,F[0],A[0],1000)===0) n++; assert.ok(n>=35&&n<=85,'Tallest Thing: 6% x 5 of them strike him instead (the fight\'s seeded stream): '+n+' of 200');
  const D=lab(H,S(['lr_1_1','lr_5_2','lr_12_2']),{foes:2,allies:2,big:true}); at(D,D.A[0],0,-5); at(D,D.A[1],0,-6.6); n=0;
  for(let i=0;i<400;i++) if(aimHit(D,D.F[0],D.A[0],1000)===0) n++; assert.ok(n>=250&&n<=310,'Draw the Storm doubles it, Every Storm Comes Here 2% x 5 more above 50% HP: 70%: '+n+' of 400');
  let m=0; for(let i=0;i<100;i++) if(aimHit(D,D.F[0],D.A[1],1000)===0) m++; assert.equal(m,0,'Draw the Storm: only within 2 m ('+(VMX('(a,b)=>dist(a,b)')(D.v,D.A[1])/V.METER-V.bodyR(D.v)-V.bodyR(D.A[1])).toFixed(2)+' m away: never)');
  D.v.hp=D.v.maxHp*0.4; n=0; for(let i=0;i<1000;i++) if(aimHit(D,D.F[0],D.A[0],1000)===0) n++; assert.ok(n>=545&&n<=655,'below 50% HP: 60%: '+n+' of 1000'); D.v.hp=D.v.maxHp;
  const CAST=VMX('(u,t)=>{ u.target=t; u._castLv=10; u._castSM=skillMul(10); try{ _doEffectCore(u,"shred",{mul:1}); } finally{ u._castSM=1; u._castLv=0; } }'); n=0;
  delete D.F[0]._talAim; for(let i=0;i<100;i++) if(lost(D.A[0],()=>CAST(D.F[0],D.A[0]))===0) n++; assert.equal(D.F[0]._talAim&&D.F[0]._talAim.t,D.A[0],'the page recorded whom the skill was aimed at'); assert.ok(n>=55&&n<=85,'a real enemy skill aimed at the ally (the page records whom it was aimed at): '+n+' of 100 drawn');
  for(let i=0;i<40;i++) assert.equal(aimHit(D,D.F[0],D.A[0],1000,{auto:true}),1000,'never a basic attack');
  for(let i=0;i<40;i++) assert.equal(aimHit(D,D.F[0],D.A[0],1000,{area:true}),1000,'never an area skill');
  for(let i=0;i<40;i++){ D.F[0]._talAim={t:D.A[1],at:V.now(),area:false}; assert.equal(hitOn(D,D.A[0],1000),1000,'never a hit the ability was not aimed at'); }
});

test('Iver / what the Rod draws: Steel Rod, Copper Rod, Bolt Taken, Struck for Them (at most 10%), The Rod Sold; the hit is his (his armor, his group)',()=>{
  const p=plain({},P=>P.v.dmg), L=lab(H,S(['lr_1_1','lr_5_2','lr_12_2','lr_2_1','lr_3_1','lr_6_1','lr_11_2','lr_12_1']),{foes:2,allies:1,big:true}), {v,A,F}=L; at(L,A[0],0,-5); setCh(L,0);
  const h=v.hp, s=v.shield||0; assert.ok(drawOne(L,F[0],A[0]),'drawn'); near(h-v.hp,880,'the drawn hit is his: Steel Rod 4% x 3 less',1e-9); near(v.shield,s+v.maxHp*0.06,'Bolt Taken: then a shield of 2% x 3 of his max HP',1e-9); near(v.shieldT,3,'for 3 s',1e-9);
  assert.equal(v._scStk,2,'Copper Rod: 2 Charge'); V.step(1); near(v.dmg,p*1.05,'Struck for Them: 1% x 5 attack');
  near(mine(L,F[0],1000),1090,'The Rod Sold: 3% x 3 more to an enemy whose ability the Rod drew'); near(mine(L,F[1],1000),1000,'not another');
  assert.ok(drawOne(L,F[1],A[0])); assert.ok(drawOne(L,F[1],A[0])); V.step(1); near(v.dmg,p*1.10,'Struck for Them: at most 10% in all'); assert.equal(v._scStk,5);
  V.wave(); V.step(2); near(v.dmg,p,'for the wave');
  const M=lab(H,S(['lr_1_1','lr_5_2','lr_12_2']),{foes:2,allies:1,big:true}); at(M,M.A[0],0,-5); const f=M.F[0];
  const drawn=()=>{ for(let k=0;k<80;k++){ f._talAim={t:M.A[0],at:V.now(),area:false}; const hv=M.v.hp; if(lost(M.A[0],()=>V.hit(f,M.A[0],1000,{kind:'phys'}))===0) return hv-M.v.hp; } return 0; };
  M.v.armorRating=0; const g0=drawn(); M.v.armorRating=3000; const g1=drawn(); assert.ok(g0>0&&g1>0);
  M.v.armorRating=0; const d0=DEF(f,M.v,'phys'); M.v.armorRating=3000; near(g1/g0,DEF(f,M.v,'phys')/d0,'a drawn hit meets his own armor, in place of the ally armor',1e-6);
});

test('Iver / Counted Bolt (LINK): a caught ability gives 3% more damage for 3 s; with Struck Once a Strike, at most once every 4 s and 3 times a wave, never the 12th',()=>{
  const L=lab(H,S(['lr_1_1','lr_5_2','lr_12_2','lr_n1','ts_1_1']),{foes:2,allies:1,big:true}), {v,A,F}=L; at(L,A[0],0,-5);
  assert.ok(drawOne(L,F[0],A[0])); near(mine(L,F[1],1000),1030,'3% more'); assert.equal(L.T.s.ivSt,1,'a Strike');
  assert.ok(drawOne(L,F[0],A[0])); assert.equal(L.T.s.ivSt,1,'not again within 4 s'); secs(3.1); near(mine(L,F[1],1000),1000,'the 3% for 3 s'); assert.ok(drawOne(L,F[0],A[0])); assert.equal(L.T.s.ivSt,1,'not at 3 s either'); secs(1); assert.ok(drawOne(L,F[0],A[0])); assert.equal(L.T.s.ivSt,2);
  secs(4.1); assert.ok(drawOne(L,F[0],A[0])); assert.equal(L.T.s.ivSt,3); secs(4.1); assert.ok(drawOne(L,F[0],A[0])); assert.equal(L.T.s.ivSt,3,'at most 3 a wave');
  V.wave(); V.step(1); setStr(L,11); secs(4.1); assert.ok(drawOne(L,F[0],A[0])); assert.equal(L.T.s.ivSt,11,'never the 12th');
  const N=lab(H,S(['lr_1_1','lr_5_2','lr_12_2','lr_n1']),{foes:2,allies:1,big:true}); at(N,N.A[0],0,-5); assert.ok(drawOne(N,N.F[0],N.A[0])); assert.ok(!N.T.s.ivSt,'without Struck Once: no Strike');
});

test('Iver / Thunder Guard: Brace, Shocked Hands, Grounded, Guard Up, Storm Skin, Stormwall with Shared Cover',()=>{
  const L=lab(H,S(['lr_2_3','lr_4_4','lr_10_4','lr_10_3','lr_7_2','lr_9_2','lr_11_4']),{foes:2,allies:1,big:true}), {v,A,F}=L, a=A[0], sm=SKM(10); a.hp=a.maxHp*0.5; v.shield=0;
  V.cast(v,'blue'); near(v.shield,v.maxHp*0.18*sm*1.15,'Brace: its shield 3% x 5 stronger'); near(v._thornT,6,'Grounded: 0.2 x 5 s longer',1e-9); near(v.shieldT,6,'',1e-9);
  near(lost(F[0],()=>V.hit(F[0],v,100,{kind:'true'})),v.dmg*Math.min(0.85,0.6*sm)*1.12*DEF(v,F[0],'phys'),'Shocked Hands: the retaliation 4% x 3 stronger');
  near(a.shield,v.maxHp*0.18*sm*1.15*0.5*1.20,'Stormwall: the most wounded ally within 4 m gets half, Shared Cover 4% x 5 stronger'); near(a.shieldT,6,'',1e-9);
  v.shield=0; near(hitOn(L,v,1000),950,'Storm Skin: 1% x 5 less while it is up'); guardOut(L); v.shield=0; near(hitOn(L,v,1000),1000,'then not');
  near(FX.cd(v,'blue',9),8.1,'Guard Up: 0.3 x 3 s shorter',1e-9);
});

test('Iver / Hold the Tower (PICK ONE) and Ring of Thunder: Thunder Guard taunts every enemy within 3 m for 1.5 s; they deal 3% x 3 less',()=>{
  const L=lab(H,S(['lr_5_3','lr_6_3']),{foes:2,allies:1,big:true}), {v,A,F}=L; V.cast(v,'blue');
  assert.equal(F[0].forcedTarget,v,'taunted'); near(F[0].forcedTargetT,1.5,'for 1.5 s',1e-9); assert.notEqual(F[1].forcedTarget,v,'not one 10 m away');
  near(hitOn(L,v,1000,{src:F[0]}),910,'Ring of Thunder: less to him'); near(hitOn(L,A[0],1000,{src:F[0]}),910,'and to his allies'); near(hitOn(L,A[0],1000,{src:F[1]}),1000,'not an untaunted one'); secs(1.6); near(hitOn(L,v,1000,{src:F[0]}),1000,'for 1.5 s');
});

test('Iver / Answering Strike: a retaliation may stun the attacker 0.5 s - never while stunned, not within 0.5 s after, at most twice each Thunder Guard',()=>{
  const L=lab(H,S(['lr_9_3']),{foes:2,big:true}), {v,F}=L, f=F[0]; free(f); V.cast(v,'blue');
  let st=0, was=0, ends=[], starts=[]; for(let i=0;i<180;i++){ V.hit(f,v,1,{kind:'true'}); const now=f.stunned>0; if(now&&!was){ st++; starts.push(V.now()); } if(!now&&was) ends.push(V.now()); was=now; V.step(1); }
  assert.ok(st>=1&&st<=2,'stunned '+st+' times in one Thunder Guard (at most twice)'); for(let i=1;i<starts.length;i++) assert.ok(starts[i]-ends[i-1]>=0.5-0.04,'a break of 0.5 s after his stun ends');
  V.cast(v,'blue'); let st2=0; was=f.stunned>0; for(let i=0;i<180;i++){ V.hit(f,v,1,{kind:'true'}); const now=f.stunned>0; if(now&&!was) st2++; was=now; V.step(1); } assert.ok(st2>=1,'a new Thunder Guard: again ('+st2+')');
});

test('Iver / Ground: Earth the Bolt, Deep Earth, Ground Thunder, Static Floor, Earthed (inside the regeneration cap), Overloaded Ground',()=>{
  const L=lab(H,S(['lr_1_4','lr_2_4','lr_7_4','lr_6_4','lr_5_4','lr_9_4']),{foes:2,big:true}), {v,F}=L; v.hp=v.maxHp*0.5;
  V.cast(v,'blue'); for(let i=0;i<20;i++) V.hit(F[0],v,1,{kind:'true'}); assert.equal(stack(L,'iv_gr'),16,'each hit while it is up stores 1 Ground, at most 10 + 2 x 3');
  v.blueCd=20; const h=v.hp; let el=0; const l=losses(F,()=>{ el=guardOut(L,true); }); const x=0.09*16*atk(v)*1.15;
  near(l[0],x,'when it ends: 3% x 3 of his attack per Ground into every enemy within 3 m, Ground Thunder 3% x 5 more',1e-3); assert.equal(l[1],0,'not one 10 m away');
  near(F[0].slowMul,0.90,'Static Floor: slowed 5% x 2',1e-9); assert.ok(F[0].slow>1.9);
  near((v.hp-h)/v.maxHp,Math.min(0.15,0.012*V.now()),'Earthed: 1% x 3 for every 3 Ground (15%), held to 1.2% of his max HP for each second',2e-2);
  near(v.blueCd,(20-el)/2,'Overloaded Ground: 10 or more: Thunder Guard cooldown halved',0.02);
  assert.equal(stack(L,'iv_gr'),0); V.cast(v,'blue'); for(let i=0;i<4;i++) V.hit(F[0],v,1,{kind:'true'}); v.blueCd=20; const el2=guardOut(L,true); near(v.blueCd,20-el2,'4 Ground: not halved',0.02);
  V.hit(F[0],v,1,{kind:'true'}); assert.equal(stack(L,'iv_gr'),0,'no Ground while it is down');
});

test('Iver / Somewhere to Go (SIGNATURE): below 40% - 5 s of every enemy hit on an ally within 6 m striking him, 40% less, the hits stored as Ground into 4 m; once every 25 s',()=>{
  const L=lab(H,S(['lr_13_2']),{foes:2,allies:2,big:true}), {v,A,F}=L; v.hp=v.maxHp*0.39; V.step(1); assert.ok(win(L,'iv_sig'),'it starts');
  const h=v.hp+(v.shield||0); near(hitOn(L,A[0],1000),0,'the ally takes nothing'); near(h-v.hp-(v.shield||0),600,'he takes it, 40% less'); near(hitOn(L,A[0],1000,{auto:true}),0,'basic attacks too');
  near(hitOn(L,A[1],1000),1000,'not an ally more than 6 m away'); near(hitOn(L,v,1000),600,'and the hits on him: 40% less');
  const x=0.09*3*atk(v), l=losses(F,()=>secs(5.1)); near(l[0],x,'it ends: 3 hits, 9% of his attack each into every enemy within 4 m',1e-3); assert.equal(l[1],0);
  v.hp=v.maxHp*0.6; V.step(1); v.hp=v.maxHp*0.39; V.step(1); assert.ok(!win(L,'iv_sig'),'once every 25 s'); v.hp=v.maxHp*0.6; secs(15); v.hp=v.maxHp*0.39; V.step(1); assert.ok(!win(L,'iv_sig'),'not 20 s later'); v.hp=v.maxHp*0.6; secs(5); v.hp=v.maxHp*0.39; V.step(1); assert.ok(win(L,'iv_sig'),'25 s later');
});

test('Iver / Father\'s Post: once a wave the killing blow on an ally within 4 m is drawn onto him',()=>{
  const L=lab(H,S(['lr_11_1']),{foes:2,allies:1,big:true}), {v,A,F}=L, a=A[0]; a.maxHp=1000; a.hp=100; const h=v.hp;
  V.hit(F[0],a,500,{kind:'true'}); assert.ok(a.alive,'the ally lives'); near(a.hp,100,'with what it had',1e-9); near(h-v.hp,500,'he takes the blow',1e-6);
  V.hit(F[0],a,500,{kind:'true'}); assert.ok(!a.alive,'once a wave');
});

test('Iver / Hair Gone White, Oilskin, Rainproof, Weathered, Lightning Lines, Iron Spear, Rod Taken Down, Signed For, Old Warden, Close Cover, Weatherproof, Planted Feet, Charged Step',()=>{
  const ps=plain({},P=>P.v.speed), L=lab(H,S(['lr_10_1','lr_3_3','sf_11_4','lr_7_1','lr_8_1','lr_8_3','ts_7_1','ts_12_1','lr_4_2','lr_6_2','lr_5_2','lr_3_2','sf_4_3']),{foes:2,allies:2,big:true}), {v,A,F}=L;
  F[1].hp=F[0].hp+5;
  near(hitOn(L,v,1000,{auto:true}),1000,'a basic attack from near, above half: nothing'); near(hitOn(L,v,1000),1000*0.925*0.925,'an ability: Oilskin and Rainproof, 1.5% x 5 each'); near(hitOn(L,v,1000,{auto:true,src:F[1]}),900,'Weathered: from more than 4 m, 2% x 5');
  v.hp=v.maxHp*0.45; near(hitOn(L,v,1000,{auto:true}),900,'Hair Gone White: below 50%, 2% x 5'); v.hp=v.maxHp;
  near(mine(L,F[0],1000,{auto:true}),1000*1.21*1.10,'Iron Spear, Rod Taken Down: his basic attacks 2% x 5 more each; Lightning Lines 2% x 5 on an enemy that hit him'); secs(3.1); near(mine(L,F[0],1000,{auto:true}),1210,'(3 s)');
  near(mine(L,F[1],1000),1090,'Signed For: 3% x 3 more on the enemy with the most HP'); near(mine(L,F[0],1000),1000);
  at(L,A[0],0,-5); at(L,A[1],3.3,-5); near(hitOn(L,A[0],1000),1000*0.955*0.90,'Old Warden (4 m) and Close Cover (2 m, under Draw the Storm) on an ally beside him'); near(hitOn(L,A[1],1000),955,'an ally 3 m away: Old Warden only');
  near(FX.cc(F[0],v,'stunned',1),0.80,'Weatherproof: controls 4% x 5 shorter (20%)',1e-9); near(v.speed,ps*1.09,'Charged Step: 3% x 3 faster');
  const P=lab(H,S(['lr_12_4']),{foes:1}), x0=P.v.x; P.v.x=x0+2*V.METER; P.v._airT=0.35; V.step(1); near((P.v.x-x0)/V.METER,0.5,'Planted Feet: a knock moves him 25% x 3 less',1e-6);
  P.v._airT=0; V.step(1); P.v.pulledBy={x:P.v.x+400,y:P.v.y,alive:true}; P.v.pullT=1; P.v.pullStop=0; P.v.pullSpeed=100; V.step(1); assert.ok(P.v.pullSpeed<=25+1e-9,'a pull: its speed 75% less ('+P.v.pullSpeed+')');
});

/* ============================== THE CAPS ============================== */
test('Iver: his damage-reduction talents are ONE group - with everything true at once they take 35% off a hit, never more; Somewhere to Go 40% on top',()=>{
  const L=lab(H,everything(H),{foes:3,big:true}), {v,F}=L, f=F[1]; v.hp=v.maxHp*0.45; V.step(1); assert.ok(!win(L,'iv_sig'));
  setCh(L,8); setStr(L,12); setWin(L,'iv_ag'); v._thornT=99; setStack(L,'iv_th',6); for(const m of ['iv_sw','iv_tnt','iv_lit']) putM(L,f,m);
  near(hitOn(L,v,1000,{src:f}),plainHit(L,()=>hitOn(L,v,1000,{src:f}))*0.65,'every condition true: held at 35%');
  const d={dps:1000,src:f,remaining:3,interval:1,acc:0}, k=FX.dotPre(v,d); near(d.dps,650,'a DoT tick too'); FX.dotPost(v,d,k);
  setWin(L,'iv_sig',3); near(hitOn(L,v,1000,{src:f}),1000*0.65*0.60,'inside Somewhere to Go: 40% less on top');
  const L2=lab(H,S(['ts_4_1']),{foes:2,big:true}); setStr(L2,12); near(hitOn(L2,L2.v,1000),880,'(one of them alone, below the cap: 12%)');
});

test('Iver: his critical-chance talents together give at most 5% (Ozone, Owed per Strike, Hard Rain after Skybreak, Lit Spear on a Lit enemy)',()=>{
  const rate=(L,t,n)=>{ const b=plainHit(L,()=>mine(L,t,1000,{kind:'phys'})); let c=0; for(let i=0;i<n;i++) if(mine(L,t,1000,{kind:'phys'})>b*1.1) c++; return c/n; };
  const O=lab(H,S(['ts_4_3']),{foes:2,big:true}), ro=rate(O,O.F[0],6000); assert.ok(ro>0.035&&ro<0.055,'Ozone: 1.5% x 3 = 4.5%: '+ro);
  const W=lab(H,S(['ts_6_1']),{foes:2,big:true}); setStr(W,2); const rw=rate(W,W.F[0],6000); assert.ok(rw>0.006&&rw<0.019,'Owed: 0.2% x 3 per Strike (2: 1.2%): '+rw);
  const S2=lab(H,S(['sf_7_1']),{foes:2,big:true}); putM(S2,S2.F[0],'iv_lit'); assert.ok(rate(S2,S2.F[1],2000)===0,'Lit Spear: not on an unlit enemy'); const rl=rate(S2,S2.F[0],6000); assert.ok(rl>0.04&&rl<0.06,'5% on a Lit one: '+rl);
  const A=lab(H,S(['ts_4_3','ts_6_1','sf_9_3','sf_7_1']),{foes:2,big:true}); setStr(A,12); setWin(A,'iv_hr'); putM(A,A.F[0],'iv_lit'); const ra=rate(A,A.F[0],8000); assert.ok(ra>0.042&&ra<0.0575,'all of them true (4.5 + 7.2 + 15 + 5%): held at 5%: '+ra);
});

/* ============================== WHOLE FIGHTS ============================== */
const units=()=>VMX('units');
test('Iver: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['ts_1_1','ts_1_4','ts_2_2','ts_3_3','ts_7_4','lr_1_1','lr_1_4','lr_11_4','sf_1_1','sf_1_4','sf_2_4']), TEAM=['vael','sylthaine','vireo','vex','iver'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]}))),4), g=U.find(u=>u.key===H);
  assert.ok(g._tal); assert.ok(U.filter(u=>u!==g).every(u=>!u._tal));
  const mx={}; let litN=0, chMax=0;
  for(let i=0;i<3000&&!V.ended()&&g.alive;i++){ V.step(1); const T0=g._tal.s; for(const k in T0.k) mx[k]=Math.max(mx[k]||0,T0.k[k].n); chMax=Math.max(chMax,T0.ivC||0);
    for(const f of units()){ if(f.team!=='enemy') continue; const o=f._talM&&f._talM[g.uid]; if(o&&o.iv_lit&&o.iv_lit.until>V.now()) litN++; } }
  console.log('  live: Strikes '+(g._tal.s.ivSt||0)+', most Charge '+chMax+', Lit enemy-ticks '+litN+', stacks '+JSON.stringify(mx));
  assert.ok((g._tal.s.ivSt||0)>=1,'a real discharge was a Strike'); assert.ok(chMax>=5,'Charge built'); assert.ok(litN>0,'a real Volt Pike lit enemies'); assert.ok(mx.iv_th>=1,'the Thunderhead darkened'); assert.ok(mx.iv_gr>=1,'Thunder Guard stored Ground');
  determinism(H,TEAM);
});

/* The page sites his talents added (the swing's pass line, the castKit discharge's scGo / scN / landPre / land, the _talAim line in _doEffectCore): with nothing
   learned, whole seeded fights with Iver in the line-up are identical to the pre-talent page (ee8edab8), seed by seed. */
const BASE_SHA=process.env.TALENT_BASE||'ee8edab85c45b52cf17c71c5e4890e03deb753bc';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-'));
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); return SH.load(path.join(dir,'emberweave-heroes.html')); }
let BASE=null; try{ BASE=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+') - the identity check against it is skipped'); }
test('Iver: no talents - whole fights with him in the line-up are identical to the pre-talent page, and they reach every site his talents added',{skip:!BASE},()=>{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['iver','vael','vireo','sylthaine','dandra'], foeTeam=['bloatus','fritz','gruel','konwu','mirelle'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>spec(k,70))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __ivN={dis:0,press:0,swing:0,cast:0}; var __ivK=castKit, __ivD=_doEffectCore, __ivU=_updateBattleCore;'+
    'castKit=function(u,ab){ if(u&&u.key==="iver"){ __ivN.press++; if(u._scReady) __ivN.dis++; } return __ivK.apply(this,arguments); };'+
    '_doEffectCore=function(u,type,o){ __ivN.cast++; return __ivD.apply(this,arguments); };'+
    '_updateBattleCore=function(dt){ const b={}; for(const u of units) if(u&&u.key==="iver") b[u.uid]=u.attackAnim||0; const r=__ivU.apply(this,arguments); for(const u of units) if(u&&u.key==="iver"&&(u.attackAnim||0)>(b[u.uid]||0)) __ivN.swing++; return r; };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>spec(k,68)))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'him on the other side, seed '+seed); n+=2; }
    const c=VMX('__ivN'); console.log('  identity: Iver swung '+c.swing+' times (the pass line), pressed '+c.press+' skills with '+c.dis+' discharges (scGo, scN, landPre, land), '+c.cast+' skill effects in all (the _talAim line)');
    assert.ok(c.swing>0&&c.dis>0&&c.cast>0,'every new site was run'); }
  finally{ VMX('castKit=__ivK; _doEffectCore=__ivD; _updateBattleCore=__ivU;'); }
  assert.ok(n>=18);
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and a build that sits at that ceiling (or is immune) for more than half a battle is too strong.
   Reported: the worst hit possible, the sustained level, the share of a fight above 85%, Somewhere to Go's window (its worst hit and its share of a fight),
   and the stun-lock rule in real fights (the longest time one enemy spends stunned by him in a row). */
const DEFS={ ts:['ts_11_4','ts_4_1','ts_3_3','ts_10_4','ts_1_4','ts_1_1'],
             lr:['lr_10_1','lr_2_1','lr_3_3','lr_7_1','lr_11_4','lr_6_3','lr_13_2','lr_1_2','lr_4_1','lr_5_1','lr_1_1'],
             sf:['sf_11_4','sf_6_4','sf_12_1','sf_3_3','sf_1_4','sf_1_1'] };
function defensive(order){ let b={r:{}}; const want=[].concat(...order.map(k=>DEFS[k])), meta=id=>T.talent(H,id);
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; }, goals=[]; for(const id of want) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x);
  for(let g=0;g<3000&&T.spent(H,b).total<91;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
    if(id){ b=T.learn(H,b,id,100).build; continue; }
    const open=goals.find(x=>(b.r[x]|0)<meta(x).ranks), tree=open?meta(open).treeIdx:null;
    const pool=T.trees(H).map((tr,i)=>tr.talents.filter(t=>(tree==null||i===tree)&&!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1]||x[2]-y[2]);
    const any=pool[0]||T.trees(H).map(tr=>tr.talents.filter(t=>T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
/* the worst hit on him: every condition of his reduction talents true at once (5 Charge, 12 Strikes, Afterglow, below 50% HP, Thunder Guard up, 6 steps, the attacker
   far, Storm-Worn, taunted by Hold the Tower and Lit, an ability), inside Somewhere to Go, normal and critical, physical and magic, with his armor; glyph reduction 0 / 30% */
function worstHit(list,kind,crit,gdr,sig){ const L=lab(H,list,{foes:3,allies:1,cold:true}), {v,F}=L; V.step(1); const f=F[1]; v.glyphDR=gdr||0;
  if(L.T){ setCh(L,8); setStr(L,12); setWin(L,'iv_ag'); setStack(L,'iv_th',6); for(const m of ['iv_sw','iv_tnt','iv_lit']) putM(L,f,m); if(sig) setWin(L,'iv_sig'); }
  v._thornT=0; v.maxHp=1e5; v.hp=4e4; v.shield=1e12; v.shieldT=999; L.T&&(v._thornT=99);
  const raw=1e6, x=lost(v,()=>V.hit(f,v,raw,{kind,crit})), cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1; return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Iver: his most defensive legal 91-point build never takes more than 95% off a hit; the sustained level, the share of a fight above 85%, Somewhere to Go, the stun-lock rule',()=>{
  const cands=[['lr','ts','sf'],['lr','sf','ts'],['ts','lr','sf'],['sf','lr','ts'],['ts','sf','lr'],['sf','ts','lr']].map(o=>{ const b=defensive(o); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  { let x={r:{}}; const want=['lr_11_2','lr_12_2','lr_13_2'], m=id=>T.talent(H,id); for(let g=0;g<600&&T.spent(H,x).total<61;g++){ const id=want.find(w=>(x.r[w]|0)<m(w).ranks&&T.canLearn(H,x,w,100)); const nx=id||T.trees(H)[1].talents.slice().sort((p,q)=>p[1]-q[1]||p[2]-q[2]).find(t=>!m(t[0]).lock&&T.canLearn(H,x,t[0],100))[0]; x=T.learn(H,x,nx,100).build; } const tr=T.trees(H)[0]; for(let g=0;g<600&&T.spent(H,x).total<91;g++){ const nx=tr.talents.slice().sort((p,q)=>p[1]-q[1]||p[2]-q[2]).find(t=>T.canLearn(H,x,t[0],100)); if(!nx) break; x=T.learn(H,x,nx[0],100).build; }
    assert.equal(T.invalid(H,x,100),''); const list=T.learned(H,x); assert.ok(list.some(e=>e[0]==='lr_13_2'),'(the signature build has Somewhere to Go)'); cands.push({o:['LR61 with Somewhere to Go','TS30'],b:x,list}); }
  for(const c of cands){ c.worst=0; c.sig=c.list.some(e=>e[0]==='lr_13_2'); for(const kind of ['magic','phys']) for(const crit of [false,true]) c.worst=Math.max(c.worst,worstHit(c.list,kind,crit,0,c.sig)); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,0)));
  let wg=0, wo=0; for(const kind of ['magic','phys']) for(const crit of [false,true]){ wg=Math.max(wg,worstHit(best.list,kind,crit,0.30,best.sig)); wo=Math.max(wo,worstHit(best.list,kind,crit,0,false)); }
  const ng=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,0.30)));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.95&&wg<0.95,'the worst possible hit on his most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'% ('+(wg*100).toFixed(1)+'% with 30% glyph reduction): below 95%');
  /* seeded fights: every hit on him as it landed; each tick a probe of what a plain enemy hit (basic attack and ability) would lose right now (his armor or magic resist
     against each living enemy, his talents' group through the incoming hook; the most favourable enemy and kind counts), with his glyphs as built and at 30%; the
     share of his time inside Somewhere to Go; and, for every enemy, each run of ticks it stays stunned while a stun of his is on it */
  VMX('var __dr={max:0,n:0,at:0,hi:0,imm:0,ticks:0,all:[],pr:[],pg:[],sig:0,sigHits:0,sigMax:0,run:{},runMax:0,runs:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="iver"&&tgt.team==="ally"&&src&&src.team!==tgt.team; let h0=0,s0=0; if(me){ h0=tgt.hp+(tgt.shield||0); s0=tgt.shield||0; } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive){ const l=h0-tgt.hp-(tgt.shield||0), raw=amt*elemMul(src,tgt); if((tgt.shield||0)<=s0&&raw>0&&l>1e-6*raw){ const d=1-l/raw; __dr.n++; __dr.all.push(d); if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++;'+
    '    const w=tgt._tal&&tgt._tal.s.w.iv_sig; if(w&&w.t>0){ __dr.sigHits++; if(d>__dr.sigMax) __dr.sigMax=d; } } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(u&&u.key==="iver"&&u.alive&&u.team==="ally"){ __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++; const T0=u._tal, w=T0&&T0.s.w.iv_sig; if(w&&w.t>0) __dr.sig++;'+
    '    let best=0,bestG=0; const sl=(u.drT>0)?u.drMul:1, gd=u.glyphDR||0;'+
    '    for(const e of units){ if(!e||!e.alive||e.team===u.team) continue; for(const k of ["phys","magic"]) for(const au of [true,false]){ const tk=T0?TalentFx.inc(u,e,1,k,au,false):1, f=sl*tk*defMul(e,u,k); const r1=1-f*(1-gd), r2=1-f*0.70; if(r1>best) best=r1; if(r2>bestG) bestG=r2; } }'+
    '    __dr.pr.push(best); __dr.pg.push(bestG);'+
    '    for(const e of units){ if(!e||e.team===u.team) continue; const o=e._talM&&e._talM[u.uid], lk=o&&o.iv_lk, his=lk&&lk.until-0.5>battleTime; const k=e.uid;'+
    '      if(e.alive&&(e.stunned||0)>0&&his){ __dr.run[k]=(__dr.run[k]||0)+dt; if(__dr.run[k]>__dr.runMax) __dr.runMax=__dr.run[k]; } else { if(__dr.run[k]) __dr.runs++; __dr.run[k]=0; } } } } return __ubc.apply(this,arguments); };');
  try{ const sn=snaps(['vael','sylthaine','vireo','vex','iver'].map(k=>Object.assign(spec(k,100,k===H?best.list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','fritz'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const d=VMX('__dr'), all=d.all.slice().sort((x,y)=>x-y), q=(A,p)=>A.length?A[Math.min(A.length-1,Math.floor(p*A.length))]:0, pr=d.pr.slice().sort((x,y)=>x-y), pg=d.pg.slice().sort((x,y)=>x-y), sh=(A,x)=>A.filter(y=>y>=x).length/Math.max(1,A.length);
    console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% inside Somewhere to Go ('+(wo*100).toFixed(1)+'% outside it; no talents '+(none*100).toFixed(1)+'%), with 30% glyph reduction '+(wg*100).toFixed(1)+'% (no talents '+(ng*100).toFixed(1)+'%);'+
      ' seeded fights: '+d.n+' hits on him, median '+(q(all,0.5)*100).toFixed(1)+'%, the most reduced '+(d.max*100).toFixed(1)+'%, 85% or more '+d.hi+', at the ceiling '+d.at+', immune ticks '+d.imm+' of '+d.ticks+
      '; probe each tick (glyphs as built): sustained (median) '+(q(pr,0.5)*100).toFixed(1)+'%, 90th percentile '+(q(pr,0.9)*100).toFixed(1)+'%, highest '+(q(pr,1)*100).toFixed(1)+'%, above 85% '+(sh(pr,0.85)*100).toFixed(1)+'% of the time, at 95% '+(sh(pr,0.95)*100).toFixed(1)+'%'+
      '; with 30% glyph reduction: sustained '+(q(pg,0.5)*100).toFixed(1)+'%, highest '+(q(pg,1)*100).toFixed(1)+'%, above 85% '+(sh(pg,0.85)*100).toFixed(1)+'% of the time, at 95% '+(sh(pg,0.95)*100).toFixed(1)+'%'+
      '; Somewhere to Go: '+(100*d.sig/Math.max(1,d.ticks)).toFixed(1)+'% of his time alive, '+d.sigHits+' hits on him inside it, the most reduced '+(d.sigMax*100).toFixed(1)+'%');
    assert.ok(d.n>30&&d.ticks>500,'hits on him: '+d.n);
    assert.ok(d.max<0.95,'no hit on him was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0,'so he never sits at the ceiling'); assert.equal(d.imm,0,'and he is never immune');
    assert.ok(sh(pg,0.95)===0,'even with 30% glyph reduction the probe never reaches 95%'); assert.ok(sh(pg,0.85)<0.5,'and it is above 85% for less than half of the fight'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
  /* the stun-lock rule in real fights: his stun builds (each tree at 91 and every talent), the longest time one enemy stayed stunned while a stun of his was on it */
  let longest=0, which=''; const STB={ts91:T.learned(H,(()=>{ let b={r:{}}; const tr=T.trees(H)[0]; for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const nx=tr.talents.slice().sort((p,q)=>p[1]-q[1]||p[2]-q[2]).find(t=>T.canLearn(H,b,t[0],100)); if(!nx) break; b=T.learn(H,b,nx[0],100).build; } return b; })()), all:everything(H)};
  VMX('var __st={run:{},max:0}; var __ub2=_updateBattleCore; _updateBattleCore=function(dt){ for(const u of units){ if(!u||u.key!=="iver"||!u.alive||!u._tal) continue; for(const e of units){ if(!e||e.team===u.team) continue; const o=e._talM&&e._talM[u.uid], lk=o&&o.iv_lk, his=lk&&lk.until-0.5>battleTime;'+
    '  if(e.alive&&(e.stunned||0)>0&&his){ __st.run[e.uid]=(__st.run[e.uid]||0)+dt; if(__st.run[e.uid]>__st.max) __st.max=__st.run[e.uid]; } else __st.run[e.uid]=0; } } return __ub2.apply(this,arguments); };');
  try{ for(const k in STB){ VMX('__st.run={}; __st.max=0'); const sn=snaps(['vael','sylthaine','vireo','vex','iver'].map(x=>Object.assign(spec(x,100,x===H?STB[k]:null),{skillLv:[100,100,100,100]})));
      for(const [node,seed] of [[34,11],[60,90210],[90,424242]]) campaign(sn,node,seed); const foe=snaps(['vex','nox','rafe','sloe','fritz'].map(x=>Object.assign(spec(x,100),{skillLv:[100,100,100,100]}))); for(const seed of [3,5]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
      const m=VMX('__st.max'); console.log('  stun-lock: '+k+' - the longest one enemy stayed stunned in a row while a stun of his was on it: '+m.toFixed(2)+' s'); if(m>longest){ longest=m; which=k; } } }
  finally{ VMX('_updateBattleCore=__ub2;'); }
  assert.ok(longest<=3+1.4+0.2,'no enemy is held by his stuns without a break for longer than his longest single stun allows ('+longest.toFixed(2)+' s, '+which+')');
});
