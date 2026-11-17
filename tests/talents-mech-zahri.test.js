'use strict';
/* Zahri Sunhorn's talents as data on the mechanics layer (talents-mech/zahri.js), family by family on the still field (tests/talents-lab.js), then the caps,
   the wave clock, whole-fight determinism, the no-talent identity, her longest stun chain and Phil's 95% ceiling.
   Lab conventions (measured while writing these tests):
   - She stands at (300,700), FREE (her stampede's run and her dash are counted in her own status pass) with speed 0 and no attack or skill of her own; lab
     foes are plain rank-0 Vaels held in place (stunned), level 1 (no resist roll), no armour or magic resist unless a test gives them some. autoUlt is off.
   - Her travel is made by moving her by hand, 0.5 m a tick, along -y (away from the foes): her tick meters it as Desert Momentum does.
   - Solar Impalement strikes her current target wherever it stands (the case has no reach test; only kitReady waits for the nearest enemy in reach), so
     the lab's F0 at 4.5 m is struck both before and after v1391's reach fix (she is not in the reach audit).
   - Noonday Stampede is cast with ULT_DEF.stampede (no HERO_ULT_ART entry for her); with no aim it runs at the farthest enemy, to the last one on its line.
   Run: node --test tests/talents-mech-zahri.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),os=require('node:os'),cp=require('node:child_process');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='zahri', S=ids=>full(H,ids), R=id=>T.talent(H,id).ranks;
const VMX=s=>vm.runInContext(s,NOW.ctx);
const TEAM=['vael','sylthaine','vireo','vex','zahri'];
const zh=L=>L.T.s.zh;
const rq=(L,t)=>zh(L).e[t.uid];
const api=()=>FX.api();
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const free=L=>{ for(const f of L.F){ f.level=1; f.ctrlRes=0; f.speed=0; f.atkCd=1e9; f.greenCd=1e9; f.blueCd=1e9; f.energy=0; f.energyReg=0; f.mrRating=0; f.armorRating=0; } };
const freeA=L=>{ for(const a of L.A){ a.stunned=0; a.level=1; a.speed=0; a.atkCd=1e9; a.greenCd=1e9; a.blueCd=1e9; a.energy=0; a.energyReg=0; } };
const freeZ=L=>{ const v=L.v; v.stunned=0; v.fearT=0; v.speed=0; v.atkCd=1e9; v.greenCd=1e9; v.blueCd=1e9; v.energy=0; v.energyReg=0; v.level=1; };
const L0=(ids,o)=>{ const L=lab(H,ids?S(ids):null,Object.assign({foes:3,big:true},o||{})); VMX('autoUlt=false'); free(L); freeA(L); freeZ(L); return L; };
const M=(ids,o,fn)=>fn(L0(ids,o));                                     // one lab, measured to the end (a new lab replaces the last one's units: never two at once)
const hitBy=(a,b,amt,o)=>lost(b,()=>V.hit(a,b,amt,Object.assign({kind:'true'},o||{})));
const walk=(L,m)=>{ const v=L.v, W=zh(L)||{}; for(let i=0;i<Math.round(m/0.5);i++){ W.wk=(W.wk||0)+1; v.y+=((Math.floor((W.wk-1)/20)%2)?1:-1)*0.5*V.METER; v._ax=v.x; v._ay=v.y; V.step(1); } };   // 0.5 m a tick, back and forth over 10 m on her far side from the foes
const castG=L=>{ L.v.target=L.F[0]; V.cast(L.v,'green'); };
const castB=L=>V.cast(L.v,'blue');
const castU=L=>VMX('(function(u){ u._castSlot="ult"; u._castLv=(u.skillLv&&u.skillLv[0])||1; u._castSM=skillMul(u._castLv); try{ doEffect(u,"stampede",Object.assign({},ULT_DEF.stampede)); } finally{ u._castSM=1; u._castLv=0; } })')(L.v);
const run=L=>{ for(let i=0;i<300&&((L.v._stampT||0)>0||L.v._stampFoes);i++) V.step(1); V.step(1); };
const mir=L=>VMX('units').filter(x=>x.alive&&x.key==='zahri mirage'&&x._summonOwner===L.v);
const mirage=L=>{ castB(L); const m=mir(L).slice(-1)[0]; assert.ok(m,'a mirage'); m._riseT=0; m.stunned=1e6; m.atkCd=1e9; V.step(2); return m; };   // risen at once, held
const respeed=(L,x)=>{ L.v.speed=x; delete L.T.s.ap.move; V.step(1); return x; };   // her speed set by hand, the stat rows applied to it afresh
const mk=(L,t,n)=>!!api().markOf(L.v,t,n);
const sunAt=(L,n)=>{ zh(L).sun=n; V.step(2); };
const DMF=L=>{ const v=L.v, pm=v.passMul||1; v._dmAS=0.5*pm; v._dmPen=120*pm; V.step(2); };

/* ============================== ACCOUNTING ============================== */
test('Zahri: every talent is accounted for - 116 talents, 10 plain stats, 106 with rows, none waiting; the caps and renames are in the data',()=>{
  accounting(H,[116,10,106,0,0]);
  for(const id of ['rn_3_3','rn_8_1','rn_11_4','hr_11_4','hr_5_1','hr_9_3','hr_1_3','sn_10_2','sn_8_1','sn_1_2']) assert.ok(FXN.has(H,id),id+' is a plain stat');
  for(const id of ['rn_2_3','sn_2_3']) assert.ok(!FXN.has(H,id),id+' joined the CRIT5 pool (not a plain stat)');
  const names={}; for(const tr of T.trees(H)) for(const t of tr.talents){ assert.ok(!names[t[3]],'a name used twice: '+t[3]); names[t[3]]=1; }
  const D=require(path.join(root,'talents-data.js')), other={}; for(const h in D.heroes) if(h!==H) for(const tr of D.heroes[h].trees) for(const t of tr.talents) other[t[3].toLowerCase()]=h;
  for(const tr of T.trees(H)) for(const t of tr.talents) assert.ok(!other[t[3].toLowerCase()],t[0]+' '+t[3]+' is another hero\'s name ('+other[t[3].toLowerCase()]+')');
  for(const id of ['rn_4_1','rn_8_4','hr_6_2','hr_n1','sn_3_3','sn_4_3','sn_10_4']) assert.ok(/at most 40% off a hit on her/.test(T.talent(H,id).text),id+' states the 40% group cap');
  for(const id of ['hr_4_2','hr_7_4']) assert.ok(/at most 25% off a hit on a mirage/.test(T.talent(H,id).text),id+' states the 25% mirage cap');
  for(const id of ['rn_n1','sn_5_1']) assert.ok(/by at most 30%/.test(T.talent(H,id).text),id+' states the 30% control cap');
  for(const id of ['rn_2_3','sn_2_3','hr_6_4','sn_9_3']) assert.ok(/at most 5% in all/.test(T.talent(H,id).text),id+' states the 5% crit pool');
  for(const id of ['rn_7_1','hr_13_2']) assert.ok(/at most 1.2% of her max HP a second/.test(T.talent(H,id).text),id+' states the regeneration cap');
  for(const id of ['rn_8_1','hr_9_3','sn_8_1']) assert.ok(/2% more damage per rank/.test(T.talent(H,id).text),id+': crit damage 10% at most');
  assert.ok(/3% more critical damage per rank/.test(T.talent(H,'sn_12_1').text),'Point Blank 9%');
  assert.ok(/3 points per rank/.test(T.talent(H,'sn_7_3').text)&&/1 point more/.test(T.talent(H,'hr_1_1').text),'points where points are meant');
  assert.ok(!/cannot drop/.test(T.talent(H,'rn_13_2').text)&&/fills at once/.test(T.talent(H,'rn_13_2').text),'Desert Momentum never drops: the signature says what it does');
  for(const id of ['rn_5_2','rn_5_3','hr_5_2','hr_5_3','sn_5_2','sn_5_3']) assert.ok(/locks/.test(T.talent(H,id).text),id+' states its lock');
  assert.ok(/up to 20%/.test(T.talent(H,'sn_5_1').text),'Steady in the Heat states its own cap');
});

/* ============================== HER REAL KIT ============================== */
test('Zahri: her real kit and the page sites - the green (her target, 44.9% for 5 s), one mirage (39.9%, cap 1, A Herd Again 2), Lance Charge\'s kitReady reach, the stampede (1.4 s stun, to the last on the line), fieldWH',()=>{
  { const P=L0(null), {v,F}=P; const h=F[0].hp; castG(P); const Q=VMX('skillScaleOpts(KITS.zahri.green,skillMul('+((v.skillLv&&v.skillLv[1])||1)+'),1)'); assert.ok(F[0].hp<h,'Solar Impalement strikes its target');
    near(F[0]._shredPct,Q.shred,'its armour cut as the skill level scales it (44.9% at 100)',1e-9); assert.equal(F[0]._shredT,5); }
  { const P=L0(null), {v}=P; const m=mirage(P); near(m.dmg/v.dmg,VMX('skLvNum("summonmirage",KITS.zahri.blue,'+((v.skillLv&&v.skillLv[2])||1)+')'),'the mirage: its share of her attack',0.02); castB(P); assert.equal(mir(P).length,1,'one at a time');
    assert.equal(VMX('kitReady')(v,v.blueAb),false,'the blue waits while it stands'); }
  { const P=L0(['hr_5_2']), {v}=P; mirage(P); assert.equal(VMX('kitReady')(v,v.blueAb),true,'A Herd Again: the page reads _zhCap'); mirage(P); assert.equal(mir(P).length,2,'two mirages'); castB(P); assert.equal(mir(P).length,2,'not three'); }
  { const f=ids=>M(ids,{foes:1},L=>{ const {v,F}=L; at(L,F[0],Math.max(v.range,v.reach)/V.METER+V.bodyR(v)+V.bodyR(F[0])+2.5,0); return VMX('kitReady')(v,v.greenAb); });
    assert.equal(f(null),false,'the green waits for the nearest enemy in her reach'); assert.equal(f(['rn_7_2']),true,'Lance Charge: 2.5 m beyond it, the page lets it start'); }
  { const P=L0(null,{foes:3}), {v,F}=P; at(P,F[0],4.5,0.5); at(P,F[1],10,0); at(P,F[2],30,0); for(const f of F) f.stunned=0; castU(P); const len=v._stampLen/V.METER;
    near(len,10,'the run ends at the last enemy on the line (F1 at 10 m; F2 at 30 m is beyond 20 m)',0.05); let st=null; for(let i=0;i<60&&!st;i++){ V.step(1); if(F[0].stunned>0) st=F[0].stunned; }
    near(st,1.4,'the stun as the page writes it: ccDur(2.0)',0.03); run(P); assert.ok(Math.abs((F[0].y-v.y)/V.METER)>0.5,'struck enemies are shoved aside'); }
  const wh=VMX('[FW,FD]'); assert.ok(wh[0]>0&&wh[1]>0,'the field size the bindMore line hands over');
});

/* ============================== HOOFBEATS ============================== */
test('Zahri / Hoofbeats: 5 m of travel each (8, Long Gallop 11), spent by her next basic that lands (Long Legs), Running Start, Wide Country, Ride Through, Gap in the Dust (+Sunlit), Hooves Like Drums, High Noon',()=>{
  { const P=L0(['rn_1_1','rn_2_1','rn_10_1']), {v,F}=P; const i0=v.atkInterval; walk(P,16); assert.equal(zh(P).hoof,3,'16 m: 3 Hoofbeats'); V.step(1); near(i0/v.atkInterval,1+0.002*R('rn_10_1')*3,'Wide Country: per banked Hoofbeat',1e-6);
    walk(P,80); assert.equal(zh(P).hoof,8+R('rn_2_1'),'8 + 1/rank Long Gallop'); const a=hitBy(v,F[0],1000,{auto:true}), b=hitBy(v,F[0],1000,{auto:true});
    near(a/b,1+0.015*R('rn_1_1')*(8+R('rn_2_1')),'Long Legs: 1.5%/rank per Hoofbeat, all spent at once',1e-6); assert.equal(zh(P).hoof,0); V.step(1); near(v.atkInterval,i0,'and Wide Country goes',1e-9);
    walk(P,10); const c=hitBy(v,F[0],1000), d=hitBy(v,F[0],1000,{auto:true}); assert.equal(c,1000,'an ability hit spends nothing'); near(d/1000,1+0.015*R('rn_1_1')*2,'the basic does',1e-6); }
  { const f=n=>M(['rn_3_1','rn_1_1','rn_2_1'],{},L=>{ walk(L,5*n+1); assert.equal(zh(L).hoof,n); return hitBy(L.v,L.F[0],1000,{auto:true})/(1+0.015*R('rn_1_1')*n); });
    assert.ok(f(6)>f(5)*1.5,'Running Start: 6 Hoofbeats spent is a guaranteed critical'); }
  { const P=L0(['rn_4_1','rn_1_1']), {v,F}=P; walk(P,16); const a=hitBy(F[0],v,1000); V.hit(v,F[0],10,{kind:'true',auto:true}); const b=hitBy(F[0],v,1000); secs(3.1); const c=hitBy(F[0],v,1000);
    near(b/a,1-0.003*R('rn_4_1')*3,'Ride Through: 0.3%/rank per Hoofbeat spent',1e-6); near(c,a,'for 3 s',1e-6); }
  { const f=ids=>M(ids,{},L=>{ const {v,F}=L; F[0].armorRating=500; walk(L,11); const a=hitBy(v,F[0],1000,{auto:true,kind:'phys'}); assert.ok(!mk(L,F[0],'zhSun')); walk(L,16); const b=hitBy(v,F[0],1000,{auto:true,kind:'phys'});
      if(ids.indexOf('sn_1_1')>=0) assert.ok(mk(L,F[0],'zhSun'),'and with Find the Gap the enemy is Sunlit'); return [a,b]; });
    const a=f(['rn_n2','sn_1_1']), b=f(['rn_12_1']); near(a[0]/b[0],1,'2 spent: nothing',1e-9); assert.ok(a[1]>b[1]*1.001,'Gap in the Dust: 3+ spent ignores 4% of the armour ('+b[1].toFixed(2)+' -> '+a[1].toFixed(2)+')'); }
  { const P=L0(['rn_12_1']); assert.equal(zh(P).hoof,2*R('rn_12_1'),'Hooves Like Drums: at the wave start'); V.wave(); VMX('battleTime=0'); zh(P).hoof=0; V.step(1); assert.equal(zh(P).hoof,2*R('rn_12_1'),'every wave'); }
  { const P=L0(['rn_9_4','rn_1_1'],{foes:3}), {v,F}=P; sunAt(P,11); walk(P,6); at(P,F[1],0,3.6); at(P,F[2],0,12); const h0=F[1].hp; V.hit(v,F[0],10,{kind:'true',auto:true}); assert.equal(F[1].hp,h0,'not before noon');
    sunAt(P,12); walk(P,6); at(P,F[1],0,3.6); at(P,F[2],0,12); const h1=F[1].hp, h2=F[2].hp; V.hit(v,F[0],10,{kind:'true',auto:true});
    assert.ok(F[1].hp<h1,'High Noon: at noon a spending basic strikes every other enemy within 2 m'); assert.equal(F[2].hp,h2,'not one farther away');
    const h3=F[1].hp; V.hit(v,F[0],10,{kind:'true',auto:true}); assert.equal(F[1].hp,h3,'a basic that spends nothing strikes nobody else'); }
});

/* ============================== THE SUN ============================== */
test('Zahri / Sun Height: a step every 4 s (Slow Sunset faster), Climbing Sun, Forenoon, Glaring Heat, Late Morning, Sunstruck, Second Sun, a new day each wave, Afternoon',()=>{
  { const P=L0(['rn_1_4']), {v}=P; const a0=v.dmg; secs(4.05); assert.equal(zh(P).sun,1,'4 s: a step'); secs(8); assert.equal(zh(P).sun,3); near(v.dmg/a0,1+0.003*R('rn_1_4')*3,'Climbing Sun: 0.3%/rank a step',1e-6);
    secs(60); assert.equal(zh(P).sun,12,'noon at 12'); V.wave(); VMX('battleTime=0'); V.step(1); assert.equal(zh(P).sun,0,'a new day each wave'); }
  { const P=L0(['rn_5_4']); secs(4-0.3*R('rn_5_4')+0.05); assert.equal(zh(P).sun,1,'Slow Sunset: 0.3 s/rank faster'); }
  { const P=L0(['rn_4_4','rn_8_4','rn_6_4']), {v,F}=P; sunAt(P,5); const a=hitBy(F[0],v,1000), x=hitBy(v,F[0],1000,{auto:true}); sunAt(P,6); const b=hitBy(F[0],v,1000);
    near(b/a,1-0.015*R('rn_8_4'),'Late Morning at 6',1e-6); sunAt(P,12); near(hitBy(v,F[0],1000,{auto:true})/x,1+0.02*R('rn_4_4'),'Glaring Heat at noon, her basics',1e-6); near(hitBy(v,F[0],1000)/1000,1,'(not her abilities)',1e-6);
    F[0].armorRating=600; sunAt(P,0); const p0=hitBy(v,F[0],1000,{kind:'phys'}); sunAt(P,10); const p1=hitBy(v,F[0],1000,{kind:'phys'}); assert.ok(p1>p0,'Sunstruck: penetration per step ('+p0.toFixed(1)+' -> '+p1.toFixed(1)+')');
    const dm=VMX('defMul'), sv=v.armorPen||0; v.armorPen=sv+10*R('rn_6_4'); const want=dm(v,F[0],'phys'); v.armorPen=sv; near(p1/1000,want,'1 penetration a rank a step',1e-6); }
  { const P=L0(['rn_12_3']), {v,F}=P; F[0].hp=1; V.hit(v,F[0],10,{kind:'true'}); assert.equal(zh(P).sun,R('rn_12_3'),'Second Sun: a kill, 1 step a rank'); }
  { const P=L0(['rn_12_4','rn_1_4']), {v}=P; secs(48.2); assert.equal(zh(P).sun,12); assert.equal(zh(P).held,1); const i0=v.atkInterval; secs(8.1); assert.equal(zh(P).aft,2,'every further 4 s');
    near(i0/v.atkInterval,1+0.005*R('rn_12_4')*2,'Afternoon: 0.5%/rank attack speed a step',1e-6); V.wave(); VMX('battleTime=0'); V.step(1); assert.equal(zh(P).sun,12,'noon holds for the rest of the fight'); secs(80); assert.equal(zh(P).aft,10,'up to 10'); }
  { const P=L0(['rn_2_4']), {v}=P; DMF(P); const i0=v.atkInterval; sunAt(P,6); const pm=v.passMul||1, cap=0.5*pm; near(i0/v.atkInterval,(1+cap*(1+0.03*R('rn_2_4')))/(1+cap),'Forenoon: the cap 3%/rank higher at 6+',1e-6);
    sunAt(P,5); near(v.atkInterval,i0,'not below 6',1e-9); }
});

/* ============================== HER TRAVEL ============================== */
test('Zahri / travel: Hot Sand, Wind at Her Back, Fast Thirst (regen cap), Toward the Water, Dust Trail, Dust Devil, No Shade, Seen Through, Ride Them Down, Hoof Rhythm, Penetrating Heat, Ninth Week',()=>{
  { const P=L0(['rn_1_2']), {v}=P; const s0=respeed(P,100); near(v.speed/s0,1+0.02*R('rn_1_2'),'Hot Sand',1e-6); }
  { const f=ids=>M(ids,{},L=>{ walk(L,10.2); return [L.v._dmAS,L.v._dmPen]; }), a=f(['rn_3_2']), b=f(['rn_1_2']); const pm=VMX('units')[0].passMul||1;
    near(a[0]-b[0],2*0.01*pm*0.10*R('rn_3_2'),'Wind at Her Back: 10%/rank more attack speed from 10 m',1e-6); near(a[1]-b[1],2*2*pm*0.10*R('rn_3_2'),'and penetration',1e-6); }
  { const P=L0(['rn_7_1']), {v}=P; v.hp=0.5*v.maxHp; const h00=v.hp; walk(P,10.2); const h0=v.hp; secs(1); const h1=v.hp; secs(5); const h2=v.hp;
    near((h1-h0)/v.maxHp,0.012,'Fast Thirst: banked, at most 1.2% of her max HP a second',1e-3); near((h2-h00)/v.maxHp,0.005*R('rn_7_1'),'all of it in time',1e-6); }
  { const P=L0(['rn_11_2']), {v,F}=P; F.forEach((f,i)=>at(P,f,6*i-6,-30)); V.step(1); v.target=F[0]; const a0=v.dmg; for(let i=0;i<21;i++){ v.y-=0.5*V.METER; v._ay=v.y; V.step(1); } V.step(1); assert.equal(api().stGet(P.T,'zhTw'),2,'10 m toward her target: 2');
    near(v.dmg/a0,1+0.004*R('rn_11_2')*2,'Toward the Water',1e-6); for(let i=0;i<21;i++){ v.y+=0.5*V.METER; v._ay=v.y; V.step(1); } assert.equal(api().stGet(P.T,'zhTw'),2,'away from it: nothing more'); secs(4.1); assert.equal(api().stGet(P.T,'zhTw'),0,'4 s after the last'); }
  { const P=L0(['rn_6_1'],{foes:2}), {v,F}=P; at(P,F[0],V.bodyR(v)+V.bodyR(F[0])+0.5,-1); at(P,F[1],0,-20); walk(P,3); near(F[0].slowMul,1-0.04*R('rn_6_1'),'Dust Trail: within 1 m while she moves',1e-9); assert.ok(!(F[1].slow>0),'not one far away'); }
  { const P=L0(['rn_9_3'],{foes:3}), {v,F}=P; const s0=respeed(P,100); V.hit(v,F[0],1,{kind:'true'}); V.hit(v,F[1],1,{kind:'true'}); V.step(2); near(v.speed/s0,1+0.005*R('rn_9_3')*2,'Dust Devil: per enemy struck in the last 3 s',1e-6); secs(3.1); near(v.speed,s0,'3 s',1e-9); }
  { const P=L0(['rn_4_3']), {v,F}=P; const a=hitBy(v,F[0],1000); secs(2.1); const b=hitBy(v,F[0],1000); near(b/a,1+0.02*R('rn_4_3'),'No Shade: an enemy that has not moved for 2 s',1e-6);
    F[0].x+=1; V.step(1); near(hitBy(v,F[0],1000),a,'one that just moved',1e-6); }
  { const P=L0(['sn_11_1']), {v,F}=P; F[0].maxHp=v.maxHp*2; F[1].maxHp=v.maxHp*0.5; F[1].hp=F[1].maxHp; near(hitBy(v,F[0],1000)/hitBy(v,F[1],1000),1+0.02*R('sn_11_1'),'Seen Through: more max HP than her',1e-6); }
  { const P=L0(['rn_12_2']), {v,F}=P; const a=hitBy(v,F[0],1000); DMF(P); near(hitBy(v,F[0],1000)/a,1+0.02*R('rn_12_2'),'Ride Them Down: Desert Momentum full',1e-6); }
  { const f=ids=>M(ids,{},L=>{ V.hit(L.v,L.F[0],1,{kind:'true',auto:true}); return [L.v._dmAS||0,L.v._dmPen||0]; }), a=f(['rn_10_3','sn_3_2']), b=f(['rn_1_2']), pm=VMX('units')[0].passMul||1;
    near(a[0]-b[0],0.005*R('rn_10_3')*pm,'Hoof Rhythm: 0.5%/rank more a basic (x passMul)',1e-9); near(a[1]-b[1],1*R('sn_3_2')*pm,'Penetrating Heat: 1/rank more a basic (x passMul)',1e-9); }
  { const P=L0(['rn_11_1'],{cold:true}), {v}=P; V.step(1); const pm=v.passMul||1; near(v._dmAS,0.25*pm,'Ninth Week: half full at the fight start',1e-9); v._dmAS=0; V.wave(); VMX('battleTime=0'); V.step(1); near(v._dmAS,0,'(the first wave only)',1e-9); }
});

/* ============================== NOONDAY STAMPEDE ============================== */
test('Zahri / the stampede: Never Turn Back (+To the Horizon), Circle the Herd (back on her line, 0.5 s longer), Underfoot, Dry Wind, Follow Me (+Stampede of Ghosts), Sun Over Shoulder (+Blind Spot)',()=>{
  const lay=L=>{ const {F}=L; at(L,F[0],4.5,0.8); at(L,F[1],10,0); at(L,F[2],30,0); for(const f of F) f.stunned=0; };
  { const P=L0(['rn_5_2','rn_6_2']), {v,F}=P; lay(P); castU(P); const len=v._stampLen/V.METER, wh=VMX('[FW,FD]'), x0=v._stampX0; near(len,Math.min(20,(wh[0]-60-x0)/V.METER),'Never Turn Back: the full 20 m (as far as the field allows)',0.02);
  }
  { const f=ids=>M(ids,{},L=>{ lay(L); const h=L.F[0].hp; castU(L); run(L); return h-L.F[0].hp; }); near(f(['rn_5_2','rn_6_2'])/f(['rn_5_2']),1+0.03*R('rn_6_2'),'To the Horizon: 3%/rank on its strikes',1e-6); }
  { const P=L0(['rn_5_3','rn_7_3','rn_10_4']), {v,F}=P; lay(P); castU(P); let st=null; for(let i=0;i<60&&!st;i++){ V.step(1); if(F[0].stunned>0) st=F[0].stunned; } V.step(1);
    near(st,1.9,'Circle the Herd: 1.4 s + 0.5 s',0.04); assert.ok(Math.abs((F[0].x-v._stampX0)*v._stampUY-(F[0].y-v._stampY0)*v._stampUX)<0.2*V.METER,'thrown back onto her line, not aside'); run(P);
    const a=hitBy(v,F[0],1000); for(let i=0;i<90&&F[0].stunned>0;i++) V.step(1); V.step(2); const b=hitBy(v,F[0],1000); near(a/1000,1+0.02*R('rn_10_4'),'Dry Wind: struck in the last 5 s',1e-6);
    near(b/1000,(1+0.02*R('rn_10_4'))*(1+0.02*R('rn_7_3')),'Underfoot: 3 s after the stun ends',1e-6); secs(3.2); near(hitBy(v,F[0],1000),1000,'both gone',1e-6); }
  { const f=ids=>M(ids,{},L=>{ lay(L); const m=ids?mirage(L):null; const h=L.F[1].hp; castU(L); run(L); if(m) assert.ok(zh(L).stats.follow>=2,'the mirage struck the enemies she struck'); return h-L.F[1].hp; });
    const a=f(['hr_7_2','hr_9_2']), b=f(null); near(a/b,1+0.40*(1+0.04*R('hr_9_2')),'Follow Me: 40% of the stampede hit a living mirage (+4%/rank Stampede of Ghosts)',0.02); }
  { const P=L0(['sn_7_4','sn_9_4','sn_2_4']), {v,F}=P; lay(P); castU(P); for(let i=0;i<60&&!mk(P,F[0],'zhGl');i++) V.step(1);
    assert.ok(mk(P,F[0],'zhSun')&&mk(P,F[0],'zhGl'),'Sun Over Shoulder: struck enemies are Sunlit and Glared'); const g=api().markOf(v,F[0],'zhGl'); near(g.until-V.now(),2+0.3*R('sn_2_4')+0.4*R('sn_9_4'),'Blind Spot + White Light',0.05); }
});

/* ============================== SOLAR IMPALEMENT AND SUNLIT ============================== */
test('Zahri / Solar Impalement and Sunlit: Lance Line, Sun-Forged Tip, Wider Opening, Through and Through, Spitting Sun, Lance Charge + Spear Point, Find the Gap, A Gap for All, Show the Way, Open to All, Hold It Open, Drive It Home + Hilt-Deep, One Gap at a Time, Gap Finder, Open Day',()=>{
  { const f=ids=>M(ids,{},L=>lost(L.F[0],()=>castG(L))); near(f(['hr_7_3','sn_7_1'])/f(null),Math.pow(1.15,2),'Lance Line x Sun-Forged Tip',1e-6); }
  { const P=L0(['sn_2_1']), {F}=P; const Q=VMX('skillScaleOpts(KITS.zahri.green,skillMul('+((P.v.skillLv&&P.v.skillLv[1])||1)+'),1)'); castG(P); near(F[0]._shredPct,Q.shred*(1+0.02*R('sn_2_1')),'Wider Opening: the cut 2%/rank larger',1e-9); }
  { const P=L0(['sn_3_1','sn_2_1','sn_1_1'],{foes:3}), {v,F}=P; at(P,F[1],4.5+V.bodyR(F[0])*2+1,0); at(P,F[2],4.5,8); const h=F.map(f=>f.hp); castG(P);
    near((h[1]-F[1].hp)/(h[0]-F[0].hp),1,'Through and Through: the enemy directly behind takes the same hit',1e-6); assert.equal(F[2].hp,h[2]); assert.ok(F[1]._shredT>0&&mk(P,F[0],'zhSun')&&mk(P,F[1],'zhSun'),'its armour cut, and both Sunlit'); }
  { const P=L0(['sn_6_1','hr_2_2']), {v}=P; near(FX.cd(v,'green',6),6-0.3*R('sn_6_1'),'Spitting Sun',1e-9); near(FX.cd(v,'blue',9),9-0.3*R('hr_2_2'),'Called Closer',1e-9); }
  { const P=L0(['rn_7_2','rn_9_2'],{foes:1}), {v,F}=P; const gap0=Math.max(v.range,v.reach)/V.METER; at(P,F[0],V.bodyR(v)+V.bodyR(F[0])+gap0+3.5,0); const x0=v.x, h=F[0].hp; castG(P); const d1=h-F[0].hp; assert.ok(v._dash,'the dash is set ('+zh(P).stats.lc+')');
    for(let i=0;i<30&&v._dash;i++) V.step(1); near((v.x-x0)/V.METER,3.5,'Lance Charge: she dashes up to 4 m toward her target',0.05);
    const Q=L0(null,{foes:1}); at(Q,Q.F[0],V.bodyR(Q.v)+V.bodyR(Q.F[0])+gap0+3.5,0); const h2=Q.F[0].hp; castG(Q); near(d1/(h2-Q.F[0].hp),1+0.03*R('rn_9_2'),'Spear Point: a dash of 3 m or more',1e-6); }
  { const P=L0(['sn_1_1','sn_12_2','sn_4_1','sn_8_2'],{allies:1}), {v,F,A}=P; castG(P); assert.ok(mk(P,F[0],'zhSun'),'Find the Gap: its target Sunlit'); const g=api().markOf(v,F[0],'zhSun'); near(g.until-V.now(),5,'for 5 s',1e-6);
    near(hitBy(A[0],F[0],1000)/hitBy(A[0],F[1],1000),(1+0.015*R('sn_1_1')+0.01*R('sn_12_2'))*(1+0.01*R('sn_8_2')),'her allies: Find the Gap + A Gap for All, and Open to All on an ability',1e-6);
    near(hitBy(A[0],F[0],1000,{auto:true})/hitBy(A[0],F[1],1000,{auto:true}),1+0.015*R('sn_1_1')+0.01*R('sn_12_2'),'(a basic attack: no Open to All)',1e-6);
    near(hitBy(v,F[0],1000)/hitBy(v,F[1],1000),1+0.01*R('sn_8_2'),'Zahri herself: only Open to All',1e-6);
    { const m=mirage(P); near(hitBy(m,F[0],1000,{auto:true})/hitBy(m,F[1],1000,{auto:true}),1,'(nor her mirage)',1e-9); }
    F[0].armorRating=F[1].armorRating=500; F[0]._shredT=0; F[1]._shredT=0; const a=hitBy(A[0],F[0],1000,{kind:'phys',auto:true})/(1+0.015*R('sn_1_1')+0.01*R('sn_12_2')), b=hitBy(A[0],F[1],1000,{kind:'phys',auto:true}); assert.ok(a>b*1.001,'Show the Way: her allies ignore some of a Sunlit enemy\'s armour'); }
  { const P=L0(['sn_5_2','sn_6_2','sn_1_1','sn_9_1'],{foes:3}), {v,F}=P; castG(P); v.target=F[1]; V.cast(v,'green'); assert.ok(!mk(P,F[0],'zhSun')&&mk(P,F[1],'zhSun'),'Hold It Open: one Sunlit enemy at a time');
    secs(30); assert.ok(mk(P,F[1],'zhSun'),'until it dies'); near(hitBy(v,F[1],1000)/hitBy(v,F[0],1000),1+0.02*R('sn_6_2'),'One Gap at a Time',1e-6);
    F[1].hp=1; V.hit(v,F[1],10,{kind:'true'}); V.step(1); assert.ok(F.filter(f=>f.alive&&mk(P,f,'zhSun')).length===1,'Gap Finder: the nearest enemy takes it'); }
  { const P=L0(['sn_5_3','sn_7_3','sn_1_1']), {v,F}=P; castG(P); const a=hitBy(v,F[0],1000,{auto:true}); assert.ok(!mk(P,F[0],'zhSun'),'Drive It Home: the gap closes'); const b=hitBy(v,F[0],1000,{auto:true});
    near(a/b,1.25+0.03*R('sn_7_3'),'25% + 3 points/rank Hilt-Deep',1e-6); }
  { const P=L0(['sn_9_1','sn_1_1'],{foes:3}), {v,F}=P; castG(P); secs(2); const left=api().markOf(v,F[0],'zhSun').until-V.now(); F[0].hp=1; V.hit(v,F[0],10,{kind:'true'}); V.step(1);
    const n=F.find(f=>f.alive&&mk(P,f,'zhSun')); assert.ok(n===F[1],'Gap Finder: the nearest enemy'); near(api().markOf(v,n,'zhSun').until-V.now(),left-V.STEP,'for the time it had left',0.05); }
  { const P=L0(['sn_11_2','sn_1_1'],{allies:2,foes:3}), {v,F,A}=P; const i0=A.map(a=>a.atkInterval), z0=v.atkInterval; for(const f of F){ v.target=f; V.cast(v,'green'); } V.step(2);
    A.forEach((a,i)=>near(i0[i]/a.atkInterval,1.10,'Open Day: three Sunlit, her allies 10% faster',1e-6)); near(v.atkInterval,z0,'(not Zahri)',1e-9); secs(5.1); A.forEach((a,i)=>near(a.atkInterval,i0[i],'then gone',1e-9)); }
});

/* ============================== GLARE ============================== */
test('Zahri / Glare: her crits (2 s, White Light), it weakens the Glared (on her, an ally, a mirage), Blinding Point, Sunspots, Blind Noon, Shadowless, Glare of Noon, Point Blank, Hot Iron, Through the Ribs, Lance Tip',()=>{
  { const P=L0(['sn_1_4','sn_2_4','sn_4_4','sn_5_4','sn_12_4'],{allies:1}), {v,F,A}=P; const c0=F[0].glyphCrit||0, i0=F[0].atkInterval;
    V.hit(v,F[0],10,{kind:'true'}); assert.ok(!mk(P,F[0],'zhGl'),'a plain hit does not Glare'); V.hit(v,F[0],10,{kind:'true',crit:true}); assert.ok(mk(P,F[0],'zhGl'),'a crit does');
    near(api().markOf(v,F[0],'zhGl').until-V.now(),2+0.3*R('sn_2_4'),'2 s + 0.3 s/rank White Light',1e-6); V.step(2);
    near((F[0].glyphCrit||0)-c0,-0.03*R('sn_5_4'),'Sunspots',1e-9); near(i0/F[0].atkInterval,1-0.03*R('sn_12_4'),'Blind Noon',1e-6);
    near(hitBy(F[0],v,1000)/hitBy(F[1],v,1000),1-0.03*R('sn_1_4'),'on her: 3%/rank less',1e-6); near(hitBy(F[0],A[0],1000)/hitBy(F[1],A[0],1000),1-0.03*R('sn_1_4'),'on an ally',1e-6);
    const m=mirage(P); near(hitBy(F[0],m,1000)/hitBy(F[1],m,1000),1-0.03*R('sn_1_4'),'on a mirage',1e-6);
    near(hitBy(v,F[0],1000,{crit:true})/hitBy(v,F[1],1000,{crit:true}),1+0.03*R('sn_4_4'),'Blinding Point',1e-6); }
  { const P=L0(['sn_6_4','sn_1_4']), {v,F}=P; F[0].shield=F[1].shield=500; F[0].shieldT=F[1].shieldT=9; V.hit(v,F[0],1,{kind:'true',crit:true}); F[0].shield=500; V.step(1);
    near(F[0].shield,500*(1-0.10*R('sn_6_4')),'Shadowless: a shield on a Glared enemy holds 10%/rank less',1e-6); near(F[1].shield,500,'not on one that is not Glared',1e-9);
    F[0].shield+=100; V.step(1); near(F[0].shield,500*(1-0.10*R('sn_6_4'))+100*(1-0.10*R('sn_6_4')),'and what it gains while Glared',1e-6); }
  { const P=L0(['sn_10_4','sn_1_4'],{foes:3}), {v,F}=P; at(P,F[1],0,4); at(P,F[2],30,0); const a=hitBy(F[2],v,1000); V.hit(v,F[0],10,{kind:'true',crit:true}); V.hit(v,F[1],10,{kind:'true',crit:true}); const b=hitBy(F[2],v,1000);
    near(b/a,Math.max(0.6,1-0.01*R('sn_10_4')*2),'Glare of Noon: 1%/rank per Glared enemy within 5 m',1e-6); }
  { const P=L0(['sn_12_1']), {v,F}=P; const a=hitBy(v,F[0],1000,{crit:true}), b=hitBy(v,F[0],1000,{crit:true}); near(a/b,1+0.03*R('sn_12_1'),'Point Blank: her first hit on each enemy',1e-6); }
  { const P=L0(['sn_12_3']), {v,F}=P; v.hp=0.5*v.maxHp; const h=v.hp; V.hit(v,F[0],10,{kind:'true'}); assert.equal(v.hp,h); V.hit(v,F[0],10,{kind:'true',crit:true}); near((v.hp-h)/v.maxHp,0.01*R('sn_12_3'),'Hot Iron: a crit heals 1%/rank',1e-6); }
  { const f=ids=>M(ids,{},L=>{ L.F[0].armorRating=500; return hitBy(L.v,L.F[0],1000,{kind:'phys'}); }), a=f(['sn_10_1']), b=f(['hr_10_3']), c=f(['sn_1_2']);
    assert.ok(a>c*1.001&&b>c*1.001,'Through the Ribs and Lance Tip ignore armour ('+c.toFixed(1)+' -> '+a.toFixed(1)+' / '+b.toFixed(1)+')'); }
});

/* ============================== HER MIRAGES ============================== */
test('Zahri / the herd: the forks (A Herd Again 2/3, One True Shape 1.5 + Desert Momentum, Truer Than Most), One Horned Shape, Remembered (5, Water on the Horizon), Old Faces, Five Names, Herd Memory, Herd Sense, Pace Keeper, Kept Pace, Lance Twin, Herdmate',()=>{
  const share=L=>{ const m=mirage(L); return [m.dmg/L.v.dmg,m.maxHp/L.v.maxHp,m,m.speed,m.atkInterval]; };
  const base=M(null,{},share);
  { const a=M(['hr_5_2'],{},share); near(a[0]/base[0],2/3,'A Herd Again: two thirds',0.01); const b=M(['hr_5_3','hr_6_3'],{},share); near(b[0]/base[0],1.5,'One True Shape: half again',0.01); near(b[1]/base[1],1.5*(1+0.03*R('hr_6_3')),'Truer Than Most',0.01);
    assert.ok(b[2].pass&&b[2].pass.desertmom,'it builds Desert Momentum'); }
  { const P=L0(['hr_1_1','hr_4_1','hr_10_1','hr_8_1','hr_3_3']), {v,F}=P; const a0=v.dmg; for(let i=0;i<6;i++){ const m=mirage(P); m.hp=1; m.shield=0; V.hit(F[0],m,10,{kind:'true'}); V.step(1); }
    assert.equal(zh(P).rem,5,'a mirage that falls is Remembered: 5 at most'); V.step(1); near(v.dmg/a0,1+0.005*R('hr_4_1')*5,'Old Faces',1e-6);
    const m=mirage(P); near(m.dmg/v.dmg,base[0]+0.01*R('hr_1_1')*5,'One Horned Shape: a point a rank per Remembered',0.02);
    near(m.shield/v.maxHp,0.01*R('hr_8_1')*5,'Herd Memory: a shield of 1%/rank of her max HP per Remembered',1e-6);
    const x=hitBy(m,F[0],1000); near(x/1000,(1+0.03*R('hr_3_3'))*(1+0.03*R('hr_10_1')),'Lance Twin x Five Names at 5',1e-6); }
  { const P=L0(['hr_12_1'],{cold:true}); V.step(1); assert.equal(zh(P).rem,R('hr_12_1'),'Water on the Horizon: Remembered at the fight start'); }
  { const P=L0(['hr_2_3','hr_2_1']), {v}=P; const a0=v.dmg; const m=mirage(P); V.step(1);
    near(v.dmg/a0,1+0.02*R('hr_2_3'),'Herd Sense: while a mirage lives',1e-6); near(base[4]/m.atkInterval,1+0.03*R('hr_2_1'),'Pace Keeper',1e-6); near(m.speed/base[3],1+0.03*R('hr_2_1'),'(and moves)',1e-6); }
  { const P=L0(['hr_11_2']), {v}=P; const m=mirage(P); V.step(1); near(m.dmg/v.dmg,base[0]+0.01*R('hr_11_2'),'Kept Pace: a point a rank above 50% HP',0.02); v.hp=0.4*v.maxHp; V.step(2); near(m.dmg/v.dmg,base[0],'not below',0.02); }
  { const P=L0(['hr_12_3']), {v}=P; DMF(P); const m=mirage(P); V.step(2); const pm=v.passMul||1; near(m._zhHmAS,0.5*pm*0.10*R('hr_12_3'),'Herdmate: 10%/rank of her Desert Momentum',1e-9); near(base[4]/m.atkInterval,1+m._zhHmAS,'it attacks that much faster',1e-6); }
});

/* ============================== MIRAGE RIDERS, SHIMMER ============================== */
test('Zahri / the herd and Shimmer: Blurred Edges + Unreal Footing (MIR25), Still Running, Grief Speed, Who Followed, Two of Her, Running Together, False Target, Close Enough to Touch, Not There, Hide in the Heat, Shimmer (+Haze of Noon), its misses, Lost in the Haze, Mirage Dust, Sun Glint',()=>{
  { const P=L0(['hr_4_2','hr_7_4','hr_1_4']), {v,F}=P; const m=mirage(P); const a=hitBy(F[0],m,1000); V.hit(m,F[1],1,{kind:'true'}); const b=hitBy(F[1],m,1000);
    near(a,1000*(1-0.04*R('hr_4_2')),'Blurred Edges',1e-6); near(b/a,1-0.02*R('hr_7_4'),'Unreal Footing: a Shimmering attacker',1e-6); }
  { const P=L0(['hr_3_1','hr_6_1','hr_11_1','hr_5_4'],{foes:3}), {v,F}=P; const s0=respeed(P,100); const m=mirage(P); m.x=F[0].x; m.y=F[0].y-(V.bodyR(m)+V.bodyR(F[0])+1)*V.METER; v.blueCd=7; m.hp=1; V.hit(F[2],m,10,{kind:'true'});
    assert.equal(v.blueCd,0,'Still Running: Mirage Herd ready at once'); v.blueCd=1e9; V.step(2); near(v.speed/s0,1+0.05*R('hr_6_1'),'Grief Speed',1e-6); assert.ok(mk(P,F[0],'zhSh')&&!mk(P,F[2],'zhSh'),'Who Followed: enemies within 2 m of it Shimmer');
    near(F[0].slowMul,1-0.03*R('hr_5_4'),'Mirage Dust',1e-9); secs(4.1); near(v.speed,s0,'4 s',1e-9); }
  { const P=L0(['hr_4_4']), {v,F}=P; const m=mirage(P); const a=hitBy(v,F[0],1000); V.hit(m,F[0],1,{kind:'true'}); const b=hitBy(v,F[0],1000); const c=hitBy(m,F[0],1000), d=hitBy(m,F[1],1000);
    near(a,1000,'Two of Her: nothing before the mirage struck',1e-6); near(b/1000,1+0.03*R('hr_4_4'),'her hit after the mirage\'s',1e-6); near(c/d,1+0.03*R('hr_4_4'),'and the mirage\'s after hers',1e-6); secs(2.1); near(hitBy(v,F[0],1000),1000,'2 s',1e-6); }
  { const P=L0(['hr_6_2','hr_n1','hr_5_2']), {v,F}=P; const a=hitBy(F[0],v,1000); const m1=mirage(P); const b=hitBy(F[0],v,1000); mirage(P); const c=hitBy(F[0],v,1000); V.hit(F[0],m1,1,{kind:'true'}); const d=hitBy(F[0],v,1000);
    near(b/a,1-0.01*R('hr_6_2'),'Running Together: one mirage',1e-6); near(c/a,1-0.02*R('hr_6_2'),'two',1e-6); near(d/c,1-0.015*R('hr_n1'),'False Target: an enemy that struck a mirage',1e-6); secs(3.1); near(hitBy(F[0],v,1000),c,'3 s',1e-6); }
  { const P=L0(['hr_12_2']), {v,F}=P; v.hp=0.5*v.maxHp; const m=mirage(P), h=v.hp; const x=hitBy(m,F[0],1000); near((v.hp-h)/x,0.01*R('hr_12_2'),'Close Enough to Touch',1e-6); }
  { const P=L0(['hr_12_4']), {v,F}=P; v.maxHp=v.hp=1e6; const m=mirage(P), mh=m.hp; const a=hitBy(F[0],v,0.1e6); near(a,0.1e6,'a hit of 10%: nothing',1e-6); const b=hitBy(F[0],v,0.2e6);
    near(b,0.2e6*(1-0.10*R('hr_12_4')),'Not There: above 15%, the mirage takes 10%/rank',1e-6); near(mh-m.hp-(m.shield||0)*0,0.2e6*0.10*R('hr_12_4'),'(it does)',1e-3); }
  { const P=L0(['hr_10_4']), {v,F}=P; const m=mirage(P); P.T.P.hide=1; const mh=m.hp; near(hitBy(F[0],v,1000),0,'Hide in the Heat: an ability hit on her strikes the mirage instead (the chance made certain here)',1e-9); assert.ok(m.hp<mh);
    near(hitBy(F[0],v,1000,{auto:true}),1000,'not a basic attack',1e-9); }
  { const P=L0(['hr_1_4','hr_3_4','hr_9_4','hr_6_4'],{foes:3}), {v,F}=P; const m=mirage(P); const c0=v.glyphCrit||0; V.hit(m,F[0],1,{kind:'true'}); assert.ok(mk(P,F[0],'zhSh'),'Shimmer: struck by her mirage');
    near(api().markOf(v,F[0],'zhSh').until-V.now(),3+0.3*R('hr_3_4'),'3 s + 0.3 s/rank Haze of Noon',1e-6); V.step(2); near((v.glyphCrit||0)-c0,0.01*R('hr_6_4'),'Sun Glint: a Shimmering enemy within 5 m',1e-9);
    const sh0=P.T.P.shim; near(sh0,0.02*R('hr_1_4'),'2%/rank',1e-12); P.T.P.shim=1; const fh=F[0].hp; near(hitBy(F[0],v,1000,{auto:true}),0,'a Shimmering enemy\'s basic attack misses (the chance made certain here)',1e-9); assert.ok(F[0].hp<fh,'Lost in the Haze: the mirage strikes it');
    near(hitBy(F[0],v,1000),1000,'(its abilities do not miss)',1e-9); near(hitBy(F[1],v,1000,{auto:true}),1000,'(nor does one not Shimmering)',1e-9);
    P.T.P.shim=sh0; let miss=0; for(let i=0;i<400;i++){ if(hitBy(F[0],v,10,{auto:true})===0) miss++; V.hit(m,F[0],1,{kind:'true'}); } assert.ok(miss>=8&&miss<=45,'about 6% of 400 miss ('+miss+')'); }
});

/* ============================== SIGNATURES ============================== */
test('Zahri / the signatures: Noon Without End, They Followed Her, The Sun Lance',()=>{
  { const P=L0(['rn_13_2','rn_1_1']), {v,F}=P; const s0=respeed(P,100), r0=v.reach; sunAt(P,12); zh(P).hoof=8; V.hit(v,F[0],10,{kind:'true',auto:true}); V.step(2);
    assert.equal(zh(P).stats.nwe,1,'8 spent at noon'); near(v.speed/s0,1.30,'30% faster',1e-6); near((v.reach-r0)/V.METER,2,'2 m more reach',1e-6); const pm=v.passMul||1; near(v._dmAS,0.5*pm,'her Desert Momentum full',1e-9);
    const a=hitBy(v,F[0],1000,{auto:true}); assert.equal(zh(P).hoof,0); near(a/1000,1+0.015*R('rn_1_1')*8,'every basic counts as spending 8',1e-6); secs(5.1); near(v.speed,s0,'5 s',1e-9); near(v.reach,r0,'and the reach',1e-6);
    zh(P).hoof=8; V.hit(v,F[0],10,{kind:'true',auto:true}); assert.equal(zh(P).stats.nwe,1,'once every 25 s'); }
  { const P=L0(['hr_13_2','hr_12_1'],{cold:true,foes:3}), {v,F}=P; V.step(1); v.maxHp=v.hp=1e6; v.hp=1000; const m=mirage(P), mh=m.hp; V.hit(F[0],v,5000,{kind:'true'});
    assert.ok(v.alive&&v.hp>=1,'a killing hit: she stands at 1 HP'); assert.ok(m.hp<mh||!m.alive,'the hit strikes her mirage'); V.step(2); const R0=mir(P).filter(x=>x._zhRisen).length; assert.equal(R0,R('hr_12_1'),'every Remembered rises');
    V.hit(F[0],v,5000,{kind:'true'}); assert.ok(v.alive,'held for 1 s'); const h=v.hp; secs(1.0); const rIn=(v.hp-h)/v.maxHp; secs(8); assert.equal(mir(P).filter(x=>x._zhRisen).length,0,'for 8 s');
    const h9=v.hp; secs(1.0); near(rIn-(v.hp-h9)/v.maxHp,0.012,'1.2% of her max HP a second while they live (and not after)',0.0008);
    v.hp=1000; const m2=mirage(P); void m2; V.hit(F[0],v,5000,{kind:'true'}); assert.ok(!v.alive,'once a fight'); }
  { const P=L0(['sn_13_2','sn_1_1','sn_1_4'],{foes:4}), {v,F}=P; at(P,F[1],4.5+5,0.4); at(P,F[2],4.5+11,0); at(P,F[3],4.5+5,6); const h0=F.map(f=>f.hp); castG(P); castG(P); assert.ok(mk(P,F[0],'zhSun')); assert.equal(zh(P).stats.sig3,0,'only Sunlit is not enough');
    V.hit(v,F[0],1,{kind:'true',crit:true}); const h=F.map(f=>f.hp); castG(P); assert.equal(zh(P).stats.sig3,1,'Sunlit and Glared: the lance goes through');
    near((h[1]-F[1].hp)/(h[0]-F[0].hp),1,'the same hit on the line behind',1e-6); assert.equal(F[3].hp,h[3],'not one off the line'); assert.ok(F[2].hp<h[2],'10 m'); assert.ok(mk(P,F[1],'zhSun')&&mk(P,F[1],'zhGl')&&mk(P,F[1],'zhZero'),'Sunlit, Glared, armour zero');
    F[1].armorRating=F[3].armorRating=800; near(hitBy(v,F[1],1000,{kind:'phys'}),1000,'its armour counts as zero for her',1e-6); void h0;
    V.hit(v,F[0],1,{kind:'true',crit:true}); castG(P); assert.equal(zh(P).stats.sig3,1,'once every 20 s'); }
});

/* ============================== CAPS ============================== */
test('Zahri: her damage-reduction talents are one product floored at 60% kept (40% off at most); a mirage\'s at 75%; control shortening at most 30%; crit chance at most 5% in all',()=>{
  const P=L0(['rn_4_1','rn_8_4','hr_6_2','hr_n1','sn_3_3','sn_4_3','sn_10_4','sn_1_4','hr_5_2','hr_4_2','hr_7_4','hr_1_4','rn_1_1','rn_2_1','rn_n1','sn_5_1','rn_2_3','sn_2_3','hr_6_4','sn_9_3'],{foes:3}), {v,F}=P;
  v.maxHp=v.hp=1e7; const m=mirage(P); mirage(P); sunAt(P,12); DMF(P); const W=zh(P); W.rdT=3; W.rdK=0.5; W.lastT=F[0]; for(const f of F){ V.hit(v,f,1,{kind:'true',crit:true}); V.hit(m,f,1,{kind:'true'}); V.hit(f,m,1,{kind:'true'}); }
  P.T.P.shim=0; near(hitBy(F[0],v,1000),600,'on her: 40% at most',1e-6); near(hitBy(F[0],m,1000),750,'on a mirage: 25% at most',1e-6);
  W.hoof=11; V.cc(F[0],v,'stunned',1); near(v.stunned,0.7*0.7,'control: 30% at most (0.7 s stun -> 0.49 s)',1e-6); v.stunned=0;
  V.step(2); near(P.T.fn.critPool(api(),P.T,v),500,'CRIT5: asked far more',1e-9); near(P.T.s.ap.crit,0.05,'5% given',1e-9);
});

/* ============================== THE WAVE CLOCK ============================== */
test('Zahri: her timers are countdowns - Ride Through, Noon Without End\'s window and lock, The Sun Lance\'s lock carry their time left across a wave change; her records of the old wave\'s enemies drop; Remembered and Hoofbeats stay',()=>{
  const P=L0(['rn_4_1','rn_13_2','sn_13_2','hr_1_1','rn_1_1']), {v,F}=P; V.hit(v,F[0],1,{kind:'true'}); assert.ok(rq(P,F[0]));
  const W=zh(P); W.rdT=2; W.nweCd=9; W.slCd=11; W.rem=3; W.hoof=4; V.step(1); const k=[W.rdT,W.nweCd,W.slCd];
  V.wave(); VMX('battleTime=0'); V.step(1);
  near(W.rdT,k[0]-V.STEP,'Ride Through',1e-6); near(W.nweCd,k[1]-V.STEP,'Noon Without End',1e-6); near(W.slCd,k[2]-V.STEP,'The Sun Lance',1e-6);
  assert.ok(!rq(P,F[0])||!rq(P,F[0]).zt,'her records of the old wave\'s enemies are dropped'); assert.equal(W.rem,3,'Remembered: the fight'); assert.equal(W.hoof,4,'Hoofbeats stay banked');
});

/* ============================== WHOLE FIGHTS ============================== */
test('Zahri: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=everything(H);
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal);
  let st=null; for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ V.step(1); const W=s._tal.s.zh; if(W) st=JSON.parse(JSON.stringify(W.stats)); }
  console.log('  live fight: '+JSON.stringify(st)); assert.ok(st&&st.hoof>=1&&st.spent>=1&&st.sun>=1,'real Hoofbeats, spends and sun steps'); assert.equal(FX.errors().n,0,'no hook errors: '+FX.errors().last);
  determinism(H,TEAM); assert.equal(FX.errors().n,0,'no hook errors: '+FX.errors().last);
});

const BASE_SHA=process.env.TALENT_BASE||'9f1c2762f837a56a68e9315f7c0cab83a9f8ea2f';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-'));
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); const h=SH.load(path.join(dir,'emberweave-heroes.html')); return {h,dir}; }
test('Zahri: no talents - whole fights with her in the line-up are identical to the pre-talent page, and they pass her changed lines (the summon cap, kitReady\'s cap and reach, the stampede)',()=>{
  let B=null; try{ B=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+')'); }
  assert.ok(B,'the pre-talent page could be loaded'); const BASE=B.h;
  try{ const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['zahri','vael','vireo','sylthaine','gruel'], foeTeam=['ambrel','carn','dandra','konwu','ceraline'];
    const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>spec(k,70))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
    VMX('var __zbN={sum:0,kr:0,krG:0,ult:0}; var __zbS=summonUnit, __zbK=kitReady, __zbD=_doEffectCore;'+
      'summonUnit=function(o,k){ if(o&&o.key==="zahri") __zbN.sum++; return __zbS.apply(this,arguments); };'+
      'kitReady=function(u,ab){ if(u&&u.key==="zahri"){ __zbN.kr++; if(ab&&ab.type==="shred") __zbN.krG++; } return __zbK.apply(this,arguments); };'+
      '_doEffectCore=function(u,type){ if(u&&u.key==="zahri"&&type==="stampede") __zbN.ult++; return __zbD.apply(this,arguments); };');
    let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
        const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
        assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
      const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>spec(k,68)))));
      for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
        assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'her on the other side, seed '+seed); n+=2; }
      const c=VMX('__zbN'); console.log('  identity: '+JSON.stringify(c)); assert.ok(c.sum>0&&c.kr>0&&c.krG>0&&c.ult>0,'the fights pass every changed line: '+JSON.stringify(c)); }
    finally{ VMX('summonUnit=__zbS; kitReady=__zbK; _doEffectCore=__zbD;'); }
    assert.ok(n>=18); } finally{ try{ fs.rmSync(B.dir,{recursive:true,force:true}); }catch(e){} }
});

/* ============================== HER STUNS IN FIGHTS ============================== */
function deep(order,caps,want){ let b={r:{}}; const meta=id=>T.talent(H,id), TI={rn:0,hr:1,sn:2};
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; };
  order.forEach((k,j)=>{ const goals=[]; for(const id of want[k]) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x); const ti=TI[k], cap=(caps&&caps[j])||91;
    for(let g=0;g<3000&&T.spent(H,b).total<91&&(T.spent(H,b).tree[T.trees(H)[ti].id]||0)<cap;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
      if(id){ b=T.learn(H,b,id,100).build; continue; } if(!goals.some(x=>(b.r[x]|0)<meta(x).ranks)) break;
      const pool=T.trees(H)[ti].talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100)).sort((x,y)=>x[1]-y[1]||x[2]-y[2]); if(!pool[0]) break; b=T.learn(H,b,pool[0][0],100).build; } });
  for(let g=0;g<600&&T.spent(H,b).total<91;g++){ const any=T.trees(H).map(tr=>tr.talents.filter(t=>!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
const STUNW={ rn:['rn_5_3','rn_7_3','rn_13_2'], hr:['hr_13_2'], sn:['sn_13_2'] };
test('Zahri: her stuns in seeded fights - the longest time one enemy spends stunned in a row by her (the stampede, Circle the Herd\'s 0.5 s)',()=>{
  const builds=[[['rn'],[91]],[['rn','hr'],[61,30]],[['rn','sn'],[61,30]],[['sn','rn'],[61,30]]].map(([o,c])=>{ const b=deep(o,c,STUNW); assert.equal(T.invalid(H,b,100),'','a legal build'); return {o,list:T.learned(H,b),b}; }).concat([{o:['none'],list:null,b:{r:{}}}]);
  VMX('var __zs={run:0,n:0,ticks:0}, __zsR=new Map(); var __zsU=_updateBattleCore;'+
    '_updateBattleCore=function(dt){ const r=__zsU.apply(this,arguments); const Z=units.find(u=>u&&u.key==="zahri"); if(!Z) return r; __zs.ticks++;'+
    '  if(Z._stampHit) for(const e of Z._stampHit){ if(!__zsR.has(e)) __zsR.set(e,{t:0,on:0}); __zsR.get(e).on=1; }'+
    '  for(const [e,q] of __zsR){ if(e.alive&&(e.stunned||0)>0&&q.on){ q.t+=dt; if(q.t>__zs.run) __zs.run=q.t; } else { q.t=0; if(!(Z._stampHit&&Z._stampHit.has(e))) q.on=0; } } return r; };');
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8'));
  try{ for(const B of builds){ VMX('__zs.run=0; __zs.ticks=0; __zsR.clear()');
      const sn=snaps(['zahri','vael','vireo','gruel','vex'].map(k=>Object.assign(spec(k,100,k===H?B.list:null),{skillLv:[100,100,100,100]})));
      for(const node of [34,60,90,120]) for(const seed of [11,90210]) NOW.campaign(JSON.parse(JSON.stringify(sn)),ENC.find(e=>e.node===node).waves,seed,[[0,'auto',-1,1,null,null]]);
      const c=JSON.parse(JSON.stringify(VMX('__zs'))); assert.ok(c.ticks>300,'she fought');
      console.log('  '+B.o.join('+')+' '+JSON.stringify(T.spent(H,B.b).tree)+': longest run of stuns on one enemy since her stampede struck it '+c.run.toFixed(2)+' s'); assert.ok(c.run<4.0,'a run of her stuns stays under 4 s'); } }
  finally{ VMX('_updateBattleCore=__zsU;'); }
});

/* ============================== PHIL'S 95% CHECK ============================== */
const DEF={ rn:['rn_4_1','rn_8_4','rn_1_1','rn_2_1','rn_n1','rn_3_3'], hr:['hr_6_2','hr_n1','hr_5_2','hr_11_4','hr_12_4','hr_13_2','hr_10_4','hr_1_3'], sn:['sn_3_3','sn_4_3','sn_10_4','sn_1_4','sn_10_2','sn_5_1'] };
function lab100(list){ const U=V.arena(snaps([Object.assign(spec(H,100,list),{skillLv:[100,100,100,100]})].concat([0,1,2,3].map(()=>spec('vael',100,null,0)))),snaps([0,1,2,3].map(()=>spec('vael',100,null,0))),7), v=U[0], F=U.filter(u=>u.team==='enemy'), A=U.filter(u=>u.team==='ally'&&u!==v);
  for(const u of U){ u.stunned=1e6; u.evaStat=0; u.blockStat=0; u.glyphCrit=0; u.glyphRegen=0; u.energyReg=0; u.energy=0; u.ctrlRes=0; u.glyphDR=0; if(u!==v){ u.maxHp=u.hp=1e9; } }
  v.x=300; v.y=700; F.forEach((f,i)=>{ f.x=v.x+[4.5,10,15.5,0][i]*V.METER; f.y=v.y+[0,0,0,6][i]*V.METER; }); A.forEach((a,i)=>{ a.x=v.x+[0,2,-2,0][i]*V.METER; a.y=v.y-[5.5,4,4,11][i]*V.METER; }); V.step(1); return {v,F,A,T:v._tal}; }
/* the worst hit on her: every condition of her reduction talents true at once - Ride Through at 11 Hoofbeats, noon, two mirages, the attacker struck a mirage, she
   attacked it last and Glared it, Desert Momentum full, 5 Glared enemies near; physical and magic, normal and critical; and again with glyph reduction at its 30% cap.
   Not There (a share MOVED onto a mirage, not reduction) is measured separately on a big hit. */
function worstHit(list,kind,crit,glyph){ const L=lab100(list), {v,F}=L, f=F[0];
  v.maxHp=1e6; v.hp=0.9*v.maxHp; v.shield=0; v.glyphDR=glyph||0; const pm=v.passMul||1; v._dmAS=0.5*pm;
  if(L.T&&L.T.s.zh){ const W=L.T.s.zh; W.rdT=9; W.rdK=0.003*5*11; W.sun=12; W.lastT=f; const r=W.e[f.uid]||(W.e[f.uid]={u:f,zt:0,mt:0,dw:0,stS:0,tr:0,ft:0,h3:0,pb:0,still:0,x:f.x,y:f.y}); r.ft=9;
    for(const x of F) FX.api().setMark(L.T,v,x,'zhGl',{dur:99}); for(const x of F.slice(1)){ x.x=v.x+2*V.METER; }
    if(L.T.r.hr_6_2){ for(let i=0;i<(L.T.r.hr_5_2?2:1);i++){ const m={uid:-1-i,alive:true,key:'zahri mirage',_talS:v}; L.T.s.sm.push(m); } } }
  const raw=1e5, h0=v.hp; V.hit(f,v,raw,{kind,crit,auto:true}); const x=h0-v.hp, cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1; if(L.T) L.T.s.sm.length=0; return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Zahri: her most defensive legal 91-point build never takes 95% off a hit, its worst hit stays under 90%, and she is at 85% or more for well under half a fight',()=>{
  const cands=[[['rn','hr'],[61,30]],[['rn','sn'],[61,30]],[['hr','rn'],[61,30]],[['hr','sn'],[61,30]],[['sn','rn'],[61,30]],[['sn','hr'],[61,30]],[['rn'],[91]],[['hr'],[91]],[['sn'],[91]]].map(([o,c])=>{ const b=deep(o,c,DEF); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; c.worstG=0; for(const kind of ['magic','phys']) for(const crit of [false,true]){ c.worst=Math.max(c.worst,worstHit(c.list,kind,crit,0)); c.worstG=Math.max(c.worstG,worstHit(c.list,kind,crit,0.30)); } }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,0))), noneG=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false,0.30)));
  console.log('  95% candidates: '+cands.map(c=>c.o.join('>')+' '+JSON.stringify(T.spent(H,c.b).tree)+' '+(c.worst*100).toFixed(1)+'% ('+(c.worstG*100).toFixed(1)+'% with 30% glyphs)').join(' | '));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.90,'the worst possible hit on her most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 90%');
  assert.ok(Math.max(...cands.map(c=>c.worstG))<0.95,'with 30% glyph reduction too: below 95%');
  VMX('var __dr={max:0,n:0,at:0,hi:0,ticks:0,t:0,tp:0,tm:0,te85:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="zahri"&&src&&src.team!==tgt.team; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive){ const raw=amt*elemMul(src,tgt), l=h0-tgt.hp-(tgt.shield||0); if(raw>0&&l>1e-6*raw){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(!(u&&u.key==="zahri"&&u.alive)) continue; __dr.ticks++;'+
    '    let s=null; for(const e of units) if(e.alive&&e.team!==u.team&&e.target===u){ s=e; break; } if(!s) s=nearestEnemy(u); if(!s) continue; const T=u._tal;'+
    '    const k=(u.drT>0?u.drMul:1)*(u.glyphDR?1-u.glyphDR:1)*(T&&T.s.zh?T.fn.drK(TalentFx.api(),T,u,s):1);'+
    '    const kp=k*defMul(s,u,"phys"), km=k*defMul(s,u,"magic"); __dr.t++; __dr.tp+=1-kp; __dr.tm+=1-km; if(1-kp>=0.85||1-km>=0.85) __dr.te85++; } return __ubc.apply(this,arguments); };');
  const seeded=(list,glyph)=>{ VMX('for(const k in __dr) __dr[k]=0'); const sp=k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]});
    const sn=snaps(['vael','sylthaine','vireo','vex','zahri'].map(sp)); if(glyph) for(const x of sn) if(x.key===H) x.glyphDR=glyph;
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','carn'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed); return JSON.parse(JSON.stringify(VMX('__dr'))); };
  try{ const d0=seeded(null), d=seeded(best.list), pc=(a,b)=>(100*a/Math.max(1,b)).toFixed(1)+'%';
    const line=(x,tag)=>tag+': '+x.n+' hits, the most reduced '+(x.max*100).toFixed(1)+'%, 85% or more '+x.hi+', at the ceiling '+x.at+'; sustained physical '+(100*x.tp/Math.max(1,x.t)).toFixed(1)+'% / magic '+(100*x.tm/Math.max(1,x.t)).toFixed(1)+'%, share of the fight at 85% or more '+pc(x.te85,x.t);
    console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%); with 30% glyphs '+(best.worstG*100).toFixed(1)+'% (no talents '+(noneG*100).toFixed(1)+'%)');
    console.log('  '+line(d0,'no talents')); console.log('  '+line(d,'that build'));
    assert.ok(d.n>20,'hits on her: '+d.n); assert.ok(d.max<0.95,'no hit on her was reduced by 95% or more'); assert.equal(d.at,0);
    assert.ok(d.te85<0.25*Math.max(1,d.t),'at 85% or more for well under half of her time ('+pc(d.te85,d.t)+')'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});
