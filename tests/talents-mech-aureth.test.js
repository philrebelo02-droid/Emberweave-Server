'use strict';
/* Aureth's talents as data on the mechanics layer (talents-mech/aureth.js), group by group on the still field (tests/talents-lab.js), then whole fights,
   the no-talent identity of the page sites his talents added, and Phil's 95% damage-reduction ceiling.
   Each group: the effect happens, has the right size, at the right time, and stops when it should. Plain numbers are measured with his talents switched
   off for one hit (plainHit) or in a plain lab built BEFORE the talented one: lab() replaces the whole field.
   Places (metres from Aureth, centre): F0 (4.5,0) F1 (10,0) F2 (15.5,0) F3 (0,6); A0 (0,-5.5) A1 (0,-11). Bodies about 2 m: F0 about 0.5 m from him
   body to body, A0 about 1.5 m, A1 about 7 m. Sunburst's own circle is 2.8 m centre to centre: tests that need it hit place an enemy at 2 m.
   Run: node --test tests/talents-mech-aureth.test.js */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),vm=require('node:vm');
const {NOW,FX,FXN,T,V,near,secs,lab,lost,stack,mark,full,everything,accounting,determinism,snaps,spec,campaign,root}=require('./talents-lab.js');
const H='aureth', S=ids=>full(H,ids);
test.afterEach(()=>{ FX.define(H,null); const e=FX.errors(), n=FXN.errors(); FX.errorsReset(); FXN.errorsReset(); assert.equal(e.n+n.n,0,'a talent hook threw: '+(e.last||n.last)); });
const VMX=s=>vm.runInContext(s,NOW.ctx);
const plain=(o,fn)=>fn(lab(H,null,o));
const plainHit=(L,fn)=>{ const T0=L.v._tal; L.v._tal=undefined; try{ return fn(); } finally{ L.v._tal=T0; } };
const setStack=(L,name,n)=>{ L.T.s.k[name]=Object.assign(L.T.s.k[name]||{},{n,t:99,idle:0}); };
const ust=(L,t,name)=>{ const o=t._talM&&t._talM[L.v.uid], m=o&&o['#'+name]; return (m&&V.now()<m.until)?m.v:0; };
const setUst=(L,t,name,n)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o['#'+name]={v:n,until:V.now()+99}; };
const setMark=(L,t,name,d)=>{ const M=t._talM||(t._talM={}), o=M[L.v.uid]||(M[L.v.uid]={}); o[name]={t0:V.now(),until:V.now()+(d||99),v:0}; };
const win=(L,name)=>{ const w=L.T.s.w[name]; return !!w&&w.t>0; };
const at=(L,u,x,y)=>{ u.x=L.v.x+x*V.METER; u.y=L.v.y+y*V.METER; };
const noDef=L=>{ for(const f of L.F){ f.mrRating=0; f.armorRating=0; } };
const free=x=>{ x.stunned=0; x.speed=0; x.level=1; };
const hitOn=(L,t,amt,o)=>lost(t,()=>V.hit(o&&o.src||L.F[0],t,amt||1000,Object.assign({kind:'true'},o||{})));   // an enemy's hit on t (true damage: no armor in the way)
const tm=v=>VMX('(u=>SKLV.twinfonts(passLv(u)))')(v);                              // Twin Fonts' strength at his passive's level
const D=L=>{ V.cast(L.v,'blue'); V.step(1); };                                       // Duality, then the tick that sees the new stance
const swing=(L,t,arm,o)=>{ o=o||{}; L.v._atkArm=arm==='d'?'attackDark':'attackLight'; return lost(t,()=>V.hit(L.v,t,o.amt||1000,Object.assign({auto:true,kind:'split'},o))); };   // a basic attack of that arm
const sun=(L,t)=>lost(t,()=>V.cast(L.v,'green',t));
const LS=v=>v.maxHp*(0.12+0.0006*VMX('lvStep')(10))+(v.apow||0)*2;                  // Duality's Light shield at skill level 10 (the lab's), as the skill writes it
const drain=v=>((v.apow||0)*0.4+2)*tm(v);                                          // Twin Fonts' drain, a second
const regen=v=>(v.maxHp*0.012+(v.apow||0)*0.25)*tm(v);                             // Twin Fonts' Light regeneration, a second

test('Aureth: every talent is accounted for - 11 plain stats, 107 with rows, none waiting',()=>{
  accounting(H,[118,11,107,0,0]);
  const M=FXN.mech(H); for(const id of ['hb_1_1','mb_1_3','tb_1_1','hb_13_2','mb_13_3','tb_13_3']) assert.ok(M.talents[id],id);
  for(const id of ['hb_12_1','hb_1_3','hb_6_2','hb_8_1','mb_2_2','mb_5_4','mb_9_2','tb_1_2','tb_6_3','tb_8_2','tb_9_2']) assert.ok(FXN.has(H,id),id+' is a plain stat');
  const crit=FXN.has(H,'hb_12_1'); assert.ok(crit);
});

test('Aureth: his real kit, as the talents read it - Twin Fonts (drain physical, regeneration), Duality (Dark buff 1.4, Light shield on every ally), Eclipse (0.42 s stun, team shield)',()=>{
  plain({foes:3,allies:2},P=>{ const {v,A,F}=P; noDef(P);
    assert.ok(v.pass.twinfonts,'his passive'); assert.equal(v._darkStance,false,'a wave starts in Light stance'); assert.equal(v.t.damageProfile,'Hybrid');
    v.hp=v.maxHp*0.5; let h=v.hp; V.step(1); near(v.hp-h,regen(v)*V.STEP,'Light stance: he regenerates (1.2% max HP + 25% AP) a second x his passive level',1e-6);
    V.cast(v,'blue'); assert.equal(v._darkStance,true); near(v.dmgBuffMul,1.4,'Duality into Dark: the damage buff 1.4'); assert.ok(v.dmgBuffT>100);
    const f=F[0]; h=f.hp; const hv=v.hp; V.step(1); near(h-f.hp,drain(v)*V.STEP*VMX('elemMul')(v,f),'Dark stance: the nearest enemy is drained (physical, so its armor applies: here none)',1e-6); assert.ok(v.hp>hv,'and he heals off it');
    near(F[1].hp,F[1].maxHp,'only the nearest');
    V.cast(v,'blue'); assert.equal(v._darkStance,false); assert.equal(v.dmgBuffT,0,'into Light: the buff ends');
    near(A[0].shield,LS(v),'into Light: every ally gets his max HP x (12% + a level step) + 2 x his ability power as a shield'); near(A[1].shield,LS(v),'wherever it stands'); near(v.shield,LS(v),'himself too'); near(v.shieldT,6,'for 6 s');
    free(F[0]); V.cast(v,'ult'); near(F[0].stunned,0.6*V.ccNerf,'Eclipse stuns 0.6 s x 0.7',1e-9); near(A[0].shield,A[0].maxHp*0.4*VMX('skillMul')(10)+v.apow*4,'and shields every ally for 40% (x the skill level) of ITS max HP + 4 x his ability power');
  });
});

/* ============================== THE HUNGRY BROTHER ============================== */
test('Aureth / Hunger: Patient Hunger, Never Full, Hunger Wakes, Hollow Room, Eat Well, Old Darkness, Gorged; it empties when he leaves Dark stance',()=>{
  const L=lab(H,S(['hb_1_1','hb_2_1','hb_10_1','hb_5_1','hb_7_1','hb_12_3','hb_9_1']),{foes:2,big:true}), {v,F}=L;
  assert.equal(stack(L,'hun'),5,'Hunger Wakes: 1 x 5 Hunger at the wave\'s start'); const n0=stack(L,'hun');
  swing(L,F[0],'d'); assert.equal(stack(L,'hun'),5,'in Light stance a hit adds none');
  D(L); for(let i=0;i<20;i++) swing(L,F[0],i%2?'d':'l'); assert.equal(stack(L,'hun'),16,'each hit he lands in Dark stance adds 1, up to 10 + 2 x 3 (Never Full)');
  const k0=stack(L,'hun'); V.step(30); assert.equal(stack(L,'hun'),k0,'Twin Fonts\' drain ticks are not hits');
  near(FX.num(v,'tfDark',100),100*(1+0.05*16),'Patient Hunger: each Hunger makes the drain 1% x 5 stronger');
  { noDef(L); const g=F[0].hp; V.step(1); near(g-F[0].hp,drain(v)*V.STEP*VMX('elemMul')(v,F[0])*(1+0.05*16),'through the passive itself',1e-6); }
  near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*(1-0.075),'Gorged: at full Hunger he takes 1.5% x 5 less');
  const ls16=v.lifestealStat, mr16=v.mrRating, at16=v.dmg; setStack(L,'hun',4); V.step(1);
  near(ls16-v.lifestealStat,0.015*12,'Eat Well: 0.3% x 5 lifesteal per Hunger'); near(at16/v.dmg,(1+0.006*16)/(1+0.006*4),'Old Darkness: 0.2% x 3 attack per Hunger'); near(mr16/v.mrRating,1.10,'Hollow Room: 2% x 5 magic resist at 5 or more Hunger, not at 4');
  near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000)),'Gorged: not at 4');
  D(L); assert.equal(stack(L,'hun'),0,'he leaves Dark stance: Hunger empties');
  D(L); swing(L,F[0],'d'); swing(L,F[0],'d'); V.wave(); V.step(1); assert.equal(stack(L,'hun'),5,'a new wave: emptied, then Hunger Wakes again');
});

test('Aureth / Hunger Outlasts: leaving Dark stance no longer empties Hunger, it runs down 1 every 2 s',()=>{
  const L=lab(H,S(['hb_1_1','hb_2_1','hb_3_1']),{foes:2,big:true}), {F}=L;
  D(L); for(let i=0;i<10;i++) swing(L,F[0],'d'); assert.equal(stack(L,'hun'),10);
  D(L); assert.equal(stack(L,'hun'),10,'kept on leaving Dark'); secs(1.9); assert.equal(stack(L,'hun'),10); secs(0.15); assert.equal(stack(L,'hun'),9,'1 after 2 s'); secs(4); assert.equal(stack(L,'hun'),7);
  D(L); secs(4); assert.equal(stack(L,'hun'),7,'not in Dark stance');
});

test('Aureth / Quiet: Gone Quiet, Long Silence, Gnawing, Hush, Lean Fang, Nothing Left',()=>{
  const L=lab(H,S(['hb_1_4','hb_3_4','hb_7_4','hb_6_4','hb_10_4','hb_12_4']),{foes:3,allies:1}), {v,A,F}=L; v.maxHp=v.hp=1e6;
  swing(L,F[0],'d'); assert.equal(ust(L,F[0],'quiet'),0,'not in Light stance');
  D(L); for(let i=0;i<3;i++) swing(L,F[0],'l'); assert.equal(ust(L,F[0],'quiet'),3,'each hit he lands in Dark stance: 1 Quiet');
  let h=F[0].hp; V.heal(F[0],1000); near(F[0].hp-h,1000*(1-0.06*3),'Gone Quiet: 2% x 3 less healing per Quiet');
  const g=swing(L,F[0],'l'), gp=plainHit(L,()=>swing(L,F[0],'l')); near(g,gp*(1+0.03*3),'Gnawing: in Dark stance his basic attacks deal 1% x 3 more per Quiet on the target');
  assert.equal(ust(L,F[0],'quiet'),4,'(the hit his talents were switched off for added none)');
  for(let i=0;i<5;i++) swing(L,F[0],'l'); assert.equal(ust(L,F[0],'quiet'),5,'max 5');
  near(hitOn(L,v,1000,{src:F[0]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[0]}))*0.92,'Hush: an enemy at 5 Quiet deals 4% x 2 less, to him'); near(hitOn(L,A[0],1000,{src:F[0]}),plainHit(L,()=>hitOn(L,A[0],1000,{src:F[0]}))*0.92,'and to his allies');
  near(hitOn(L,v,1000,{src:F[1]}),plainHit(L,()=>hitOn(L,v,1000,{src:F[1]})),'not one with less');
  D(L); secs(5.9); assert.equal(ust(L,F[0],'quiet'),5,'Long Silence: Quiet lasts 4 s + 0.4 x 5'); secs(0.2); assert.equal(ust(L,F[0],'quiet'),0,'then all of it lapses');
  D(L); swing(L,F[2],'l'); v.hp=v.maxHp*0.5; h=v.hp; F[2].hp=1; V.dmg(F[2],1e3); assert.ok(!F[2].alive); near(v.hp-h,v.maxHp*0.025,'Lean Fang: an enemy with Quiet dies, he heals 0.5% x 5 of his max HP',1e-6);
  assert.equal(ust(L,F[1],'quiet'),2,'Nothing Left: the nearest enemy gains 1 x 2 Quiet');
  h=v.hp; F[0].hp=1; const q0=ust(L,F[1],'quiet'); setUst(L,F[0],'quiet',0); V.dmg(F[0],1e3); near(v.hp,h,'one without Quiet: nothing',1e-9); assert.equal(ust(L,F[1],'quiet'),q0);
});

test('Aureth / Then Dark (PICK ONE, its own lab): an enemy that reaches 5 Quiet cannot be healed at all for 2 s',()=>{
  const L=lab(H,S(['hb_5_2']),{foes:2}), {F}=L; D(L); for(let i=0;i<4;i++) swing(L,F[0],'l');
  let h=F[0].hp; V.heal(F[0],1000); near(F[0].hp-h,1000,'at 4: healed (no Gone Quiet learned)');
  swing(L,F[0],'l'); h=F[0].hp; V.heal(F[0],1000); near(F[0].hp,h,'it reaches 5: no healing',1e-9); secs(1.9); h=F[0].hp; V.heal(F[0],1000); near(F[0].hp,h,'',1e-9);
  secs(0.15); swing(L,F[0],'l'); h=F[0].hp; V.heal(F[0],1000); near(F[0].hp-h,1000,'2 s later, and a hit while it stays at 5 does not block it again');
});

test('Aureth / Then Still (PICK ONE, its own lab) and Stillness Spreads: reaching 5 Quiet, it cannot move for 1 s and its Quiet empties; the nearest other enemy gains 1 x 3',()=>{
  const L=lab(H,S(['hb_5_3','hb_6_3']),{foes:3}), {F}=L; const s0=F[0].speed; D(L);
  for(let i=0;i<5;i++) swing(L,F[0],'l'); assert.equal(ust(L,F[0],'quiet'),0,'its Quiet empties'); assert.ok(mark(L,F[0],'root'));
  V.step(1); assert.equal(F[0].speed,0,'it cannot move'); assert.equal(ust(L,F[1],'quiet'),3,'Stillness Spreads: the nearest other enemy gains 3');
  secs(1.05); V.step(1); near(F[0].speed,s0,'after 1 s its speed is back');
});

test('Aureth / his basic attacks: Dark Arm, Bitter Root, Weight of Night, Even Split, Through Plate, Edge of Night, Two Points, Both Hands',()=>{
  const L=lab(H,S(['hb_2_2','hb_11_1','hb_10_2','tb_2_3','hb_3_3','hb_9_3','tb_3_2','tb_4_3']),{foes:2,big:true}), {v,F}=L; const f=F[0]; f.armorRating=400; f.mrRating=300;
  const dm=(k,ign)=>{ const a=VMX('defMul')(v,f,k); let b;
    if(k==='phys'){ const sv=v._wpnArmIgn; v._wpnArmIgn=ign; b=VMX('defMul')(v,f,k); v._wpnArmIgn=sv; } else { const sv=f.mrRating; f.mrRating=sv*(1-ign); b=VMX('defMul')(v,f,k); f.mrRating=sv; } return b/a; };
  const gp=plainHit(L,()=>swing(L,f,'l')), sp=Object.assign({},f._splitLast);
  const fac=(sp.phys*(0.5/0.7)*dm('phys',0.175)+sp.mag*(0.5/0.3)*dm('magic',0.15)*1.15)/(sp.phys+sp.mag);
  near(swing(L,f,'l'),gp*fac*1.10,'light arm: Even Split (70/30 to 50/50), the armor (10% + 7.5%) and magic resist (7.5% + 7.5%) ignored, Weight of Night (+15% on the magic part), Bitter Root (+10%)');
  near(swing(L,f,'d'),plainHit(L,()=>swing(L,f,'d'))*fac*1.10*1.15,'dark arm: and Dark Arm (+3% x 5)');
  near(swing(L,f,'l',{crit:true}),plainHit(L,()=>swing(L,f,'l',{crit:true}))*fac*1.10*1.12,'Both Hands: his critical basic attack (the both-swords slice) 4% x 3 more');
  at(L,f,2,0); const s=sun(L,f), s0=plainHit(L,()=>sun(L,f)); near(s,s0*dm('magic',0.15),'a magic skill hit: the magic resist ignored');
});

test('Aureth / Dark Swing: dark-arm basic attacks have 1.5% x 3 more critical chance (the fight\'s seeded stream)',()=>{
  const L=lab(H,S(['hb_4_2']),{foes:1,big:true}), {F}=L; let d=0, l=0;
  for(let i=0;i<600;i++){ F[0]._critHit=false; swing(L,F[0],'d',{amt:10}); if(F[0]._critHit) d++; F[0]._critHit=false; swing(L,F[0],'l',{amt:10}); if(F[0]._critHit) l++; }
  assert.equal(l,0,'light arm: none'); assert.ok(d>=12&&d<=48,'about 4.5% of 600 dark-arm swings: '+d);
});

test('Aureth / his skills: Dark Flash, Brighter Burst, Judged Twice, Noon Goes Dark, Measured Dark; Duality\'s numbers: Hungry Stance, Quick Turn, Sun at Rest, Golden Flash, Fine Balance',()=>{
  const L=lab(H,S(['hb_7_3','tb_4_2','tb_9_4','hb_8_2','tb_7_2','hb_4_3','hb_8_3','mb_10_2','mb_6_3','tb_3_1']),{foes:3,big:true}), {v,F}=L; const f=F[0]; for(const x of F) free(x);
  at(L,f,2,0); near(sun(L,f),plainHit(L,()=>sun(L,f))*1.15*1.15,'Sunburst: 3% x 5 and 5% x 3 more');
  setMark(L,f,'wd'); near(sun(L,f),plainHit(L,()=>sun(L,f))*1.15*1.15*1.15,'Judged Twice: 3% x 5 more to a Weighed enemy');
  const e=lost(F[1],()=>V.cast(v,'ult')); at(L,F[1],10,0); const e0=plainHit(L,()=>{ at(L,F[1],4.5,3); return lost(F[1],()=>V.cast(v,'ult')); });
  at(L,F[1],4.5,3); near(lost(F[1],()=>V.cast(v,'ult')),plainHit(L,()=>lost(F[1],()=>V.cast(v,'ult')))*1.15*1.15,'Eclipse: 3% x 5 and 3% x 5 more');
  D(L); near(v.dmgBuffMul,1.46,'Hungry Stance: Duality\'s Dark buff 2% x 3 stronger');
  near(FX.cd(v,'blue',6),6-0.9-0.9-1.0,'Duality\'s cooldown: Quick Turn 0.3 x 3, Sun at Rest 0.3 x 3, Fine Balance 0.2 x 5 (the Scales start level)');
  near(FX.cd(v,'green',8),8-0.75,'Golden Flash: Sunburst\'s 0.15 x 5 shorter');
  setStack(L,'sc',2); near(FX.cd(v,'blue',6),6-1.8,'Fine Balance: not with the Scales 3 from level');
});

test('Aureth / The Hand Closes, Long Eclipse, Last Word Taken: Eclipse and Sunburst in Dark stance fill the Quiet',()=>{
  const L=lab(H,S(['hb_11_2','hb_12_2','hb_9_4']),{foes:3,big:true}), {v,F}=L; noDef(L); for(const x of F) free(x);
  at(L,F[1],-2,0); V.cast(v,'green',F[1]); assert.equal(ust(L,F[1],'quiet'),0,'Last Word Taken: only in Dark stance');
  D(L); at(L,F[1],-2,0); at(L,F[0],7.5,0); const s=lost(F[1],()=>V.cast(v,'green',F[1]))   /* talents-fix1: since v1391 Sunburst reaches to the body edge - F0 at 4.5 m (a 2.49 m gap) is now inside 2.8 m, so it stands at 7.5 m here */, s0=plainHit(L,()=>lost(F[1],()=>V.cast(v,'green',F[1])));
  assert.equal(ust(L,F[1],'quiet'),3,'Last Word Taken: 2 Quiet to each enemy it hits (and 1 for the hit)'); near(s-s0,drain(v),'and Twin Fonts drains it: 1 s of its drain at once',1e-6);
  assert.equal(ust(L,F[0],'quiet'),0,'not one it did not reach');
  at(L,F[0],4.5,0); at(L,F[1],10,0); V.cast(v,'ult'); assert.equal(ust(L,F[0],'quiet'),5,'The Hand Closes: 5 Quiet to every enemy Eclipse hits'); assert.equal(stack(L,'hun'),10,'and full Hunger'); assert.equal(ust(L,F[1],'quiet'),3,'not 10 m away (what Sunburst gave it, unchanged)');
  near(swing(L,F[0],'l'),plainHit(L,()=>swing(L,F[0],'l'))*1.10,'Long Eclipse: they take 2% x 5 more from him'); secs(6.05); near(swing(L,F[0],'l'),plainHit(L,()=>swing(L,F[0],'l')),'for 6 s');
  D(L); setStack(L,'hun',0); V.cast(v,'ult'); assert.equal(stack(L,'hun'),0,'not in Light stance');
  const E=lab(H,S(['hb_9_4']),{foes:3,big:true}); noDef(E); for(const x of E.F) free(x); D(E); at(E,E.F[1],-2,0); at(E,E.F[0],4.5,0); V.cast(E.v,'green',E.F[1]);
  assert.equal(ust(E,E.F[0],'quiet'),3,'Last Word Taken: an enemy whose body is 2.49 m away is hit by Sunburst (v1391: to the body edge) and gets its 2 Quiet as well'); assert.equal(ust(E,E.F[2],'quiet'),0,'(15.5 m away: no)');
});

test('Aureth / The Second Brother Speaks (SIGNATURE): at full Hunger in Dark stance, 5 s of triple drain, 2 Quiet a hit, a 1 s stun at 5 Quiet, then Duality turns him to Light; once every 25 s',()=>{
  const L=lab(H,S(['hb_13_2','hb_1_1']),{foes:3,allies:1,big:true}), {v,A,F}=L; D(L); for(let i=0;i<10;i++) swing(L,F[0],'l'); V.step(1);
  assert.ok(win(L,'sp'),'full Hunger: the hungry brother speaks'); near(FX.num(v,'tfDark',100),100*1.5*3,'Twin Fonts drains triple (and Patient Hunger)');
  free(F[1]); swing(L,F[1],'l'); assert.equal(ust(L,F[1],'quiet'),2,'every hit adds 2 Quiet'); swing(L,F[1],'l'); assert.equal(F[1].stunned||0,0); swing(L,F[1],'l');
  assert.equal(ust(L,F[1],'quiet'),5); near(F[1].stunned,1,'reaching 5 Quiet: stunned 1 s, in full',1e-9);
  secs(4.0); assert.equal(v._darkStance,true); A[0].shield=0; secs(1.1); assert.equal(v._darkStance,false,'when it ends Duality turns him to Light'); near(A[0].shield,LS(v),'its Light shield too');
  D(L); for(let i=0;i<10;i++) swing(L,F[0],'l'); V.step(1); assert.ok(!win(L,'sp'),'once every 25 s'); secs(19.0); assert.ok(!win(L,'sp'),'not after about 24.2 s'); secs(1.0); assert.ok(win(L,'sp'),'25 s after the first, again');
});

test('Aureth / Light stance regeneration: Starve the Light (RISK), Closing Wounds, Mending Light',()=>{
  const L=lab(H,S(['hb_6_1','mb_6_4','mb_12_4']),{foes:2,big:true}), {v,F}=L; v.hp=v.maxHp*0.5;
  near(FX.num(v,'tfLight',100),100*0.85*1.15*1.09,'regeneration: 5% x 3 weaker, 5% x 3 and 3% x 3 stronger');
  v.hp=v.maxHp*0.5; const h=v.hp; V.step(1); near(v.hp-h,regen(v)*V.STEP*0.85*1.15*1.09,'through the passive itself',1e-6);
  const hh=v.hp; V.heal(v,1000); near(v.hp-hh,1090,'Mending Light: 3% x 3 more healing in Light stance');
  near(swing(L,F[0],'l'),plainHit(L,()=>swing(L,F[0],'l')),'Starve the Light: no more damage in Light'); D(L); near(swing(L,F[0],'l'),plainHit(L,()=>swing(L,F[0],'l'))*1.06,'in Dark stance 2% x 3 more');
  const h2=v.hp; V.heal(v,1000); near(v.hp-h2,1000,'Mending Light: not in Dark');
});

/* ============================== THE MENDING BROTHER ============================== */
test('Aureth / Overgrowth: Green and Unwilling, Rootbound, First Light, Overgrown Fists, Overflowing',()=>{
  const P0=lab(H,null,{foes:2,allies:2}), atk0=P0.v.dmg;
  const L=lab(H,S(['mb_1_4','mb_2_4','mb_3_4','mb_9_1','mb_10_4']),{foes:2,allies:2}), {v,A}=L; const cap=v.maxHp*(0.15+0.06+0.05);
  near(stack(L,'og'),v.maxHp*0.05+regen(v)*V.STEP,'First Light: the wave starts with Overgrowth worth 1% x 5 of his max HP (and the first tick of regeneration at full HP)'); V.step(1); near(v.dmg,atk0*(1+0.02*5),'Overgrown Fists: 0.4% x 5 attack per 1% stored');
  v.hp=v.maxHp; const o0=stack(L,'og'); V.step(30); near(stack(L,'og')-o0,regen(v)*V.STEP*30,'at full HP, the regeneration that would pass full is stored',1e-6);
  setStack(L,'og',cap*2); V.step(1); near(stack(L,'og'),cap,'up to 5% x 3 + 2% x 3 + 1% x 5 of his max HP');
  const og=stack(L,'og'); A[0].hp=A[0].maxHp*0.2; A[1].hp=A[1].maxHp*0.1; v.shield=0; D(L); assert.equal(v.shield,0,'Duality into Dark: nothing');
  V.cast(v,'blue'); near(v.shield,LS(v)+og,'into Light: all the stored Overgrowth is added to his own shield'); near(A[0].shield,LS(v)+og*0.5,'Overflowing: half of it again to the lowest-health ally within 6 m');
  near(A[1].shield,LS(v),'not the lower one 7 m away'); assert.equal(stack(L,'og'),0,'spent');
});

test('Aureth / Unending: Refuses to End, Long Green, Gentle Pressure, Grown Green, Zenith',()=>{
  const L=lab(H,S(['mb_1_3','mb_2_3','mb_7_1','mb_8_3','mb_7_4']),{foes:2,allies:2}), {v,A,F}=L; v.maxHp=v.hp=1e6;
  D(L); assert.ok(!mark(L,A[0],'un'),'no Light shield yet: nobody Unending'); V.cast(v,'blue');
  assert.ok(mark(L,A[0],'un')&&mark(L,A[1],'un')&&mark(L,v,'un'),'every ally the Light shield covers is Unending, himself too');
  A[0].hp=A[0].maxHp*0.5; v.hp=v.maxHp*0.5; const a0=A[0].hp; secs(1.02); near(A[0].hp-a0,A[0].maxHp*0.01*1.10,'Refuses to End: 0.2% x 5 of its max HP each second (and Grown Green)',1e-3);
  near(lost(F[0],()=>V.hit(A[0],F[0],1000,{kind:'true'})),plainHit(L,()=>lost(F[0],()=>V.hit(A[0],F[0],1000,{kind:'true'})))*1.05,'Gentle Pressure: Unending allies deal 1% x 5 more');
  near(swing(L,F[0],'l'),plainHit(L,()=>swing(L,F[0],'l'))*1.05,'he too');
  let h=A[0].hp; V.heal(A[0],1000); near(A[0].hp-h,1100,'Grown Green: 2% x 5 more healing'); h=v.hp; V.heal(v,1000); near(v.hp-h,1100,'him too');
  secs(3.55); assert.ok(!mark(L,A[0],'un'),'Long Green: 3 s + 0.5 x 3'); h=A[0].hp; V.heal(A[0],1000); near(A[0].hp-h,1000);
  V.cast(v,'ult'); assert.ok(mark(L,A[1],'un'),'Zenith: Eclipse\'s team shield makes them Unending');
});

test('Aureth / Will Not End: an Unending ally cannot drop below 1 HP during its first 1 s, once per ally per wave',()=>{
  const L=lab(H,S(['mb_1_3','mb_9_3']),{foes:2,allies:2}), {v,A}=L; D(L); V.cast(v,'blue');
  const a=A[0]; a.hp=100; V.dmg(a,1e12); assert.ok(a.alive&&a.hp===1,'held at 1 HP'); V.step(3); V.dmg(a,1e12); assert.ok(a.alive,'through its first 1 s');
  secs(1.0); V.dmg(a,1e12); assert.ok(!a.alive,'then it falls');
  secs(2.1); D(L); V.cast(v,'blue'); assert.ok(mark(L,v,'un1'),'Unending again (it had lapsed): a new first 1 s');
  v.hp=10; V.dmg(v,1e12); assert.ok(v.alive,'Aureth himself, Unending in his first second, too');
  A[1].hp=100; V.dmg(A[1],1e12); assert.ok(A[1].alive,'another ally: its own once a wave');
  secs(3.2); D(L); V.cast(v,'blue'); V.step(1); assert.ok(mark(L,A[1],'un1')); A[1].hp=100; V.dmg(A[1],1e12); assert.ok(!A[1].alive,'the same ally again this wave: no');
});

test('Aureth / the Light shield: Bright Shell, Clear Eyes, Light Holds, Longer Than Light',()=>{
  const L=lab(H,S(['mb_6_1','mb_10_3','mb_11_3','mb_12_3']),{foes:2,allies:2}), {v,A}=L; A[0].hp=A[0].maxHp*0.2; D(L); v.shield=0; V.cast(v,'blue');
  near(v.shield,LS(v)*1.08,'Bright Shell: 4% x 2 stronger'); near(A[0].shield,LS(v)*1.08*1.09,'Clear Eyes: the lowest-health ally within 6 m 3% x 3 more'); near(A[1].shield,LS(v)*1.08,'');
  near(A[1].shieldT,8.5,'Light Holds: 0.5 x 5 longer');
  v.hp=v.maxHp*0.5; let h=v.hp; secs(1.0); near(v.hp-h,regen(v)*1.0+v.maxHp*0.015,'Longer Than Light: 0.3% x 5 of his max HP a second while it holds (and his regeneration)',2e-2);
  v.shield=0; V.step(2); h=v.hp; secs(1.0); near(v.hp-h,regen(v)*1.0,'then not',2e-2);
  at(L,A[0],0,-2.5); A[0].hp=A[0].maxHp*0.1; const g=lost(A[0],()=>V.cast(v,'green',v))*-1; A[0].hp=A[0].maxHp*0.1; const g0=plainHit(L,()=>lost(A[0],()=>V.cast(v,'green',v))*-1);
  near(g,g0*1.09,'Clear Eyes: his heals on it 3% x 3 more (Sunburst)');
});

test('Aureth / Eclipse\'s team shield: Bright Shell, Ring of Fire Ring of Shade, Two Rings, Sun-Warmed',()=>{
  const L=lab(H,S(['mb_6_1','mb_8_2','tb_7_1','mb_12_1']),{foes:2,allies:2}), {v,A}=L; V.cast(v,'ult');
  const sm=VMX('skillMul')(10); near(A[0].shield,(A[0].maxHp*0.4*sm+v.apow*4)*1.08*1.24,'Bright Shell 4% x 2; Ring of Fire, Ring of Shade and Two Rings 4% x 3 each (they add: one number)'); near(v.shield,(v.maxHp*0.4*sm+v.apow*4)*1.08*1.24,''); near(A[1].shieldT,7,'Sun-Warmed: 0.5 x 2 longer');
});

test('Aureth / Ward the One (PICK ONE, its own lab) with Chosen Ally: the lowest-health ally gets his Light shield at 130%, he gives his own up',()=>{
  const L=lab(H,S(['mb_5_2','mb_6_2']),{foes:2,allies:2}), {v,A}=L; A[1].hp=A[1].maxHp*0.1; D(L); v.shield=0; V.cast(v,'blue');
  near(A[1].shield,LS(v)*1.3,'the lowest-health ally (wherever it stands): 30% stronger'); near(v.shield,0,'Aureth: none',1e-9); near(A[0].shield,LS(v),'the others keep theirs');
  near(hitOn(L,A[1],1000),plainHit(L,()=>hitOn(L,A[1],1000))*0.94,'Chosen Ally: it takes 2% x 3 less while it holds'); near(hitOn(L,A[0],1000),plainHit(L,()=>hitOn(L,A[0],1000)),'not the others');
  A[1].shield=0; V.step(2); near(hitOn(L,A[1],1000),plainHit(L,()=>hitOn(L,A[1],1000)),'its shield gone: no more');
});

test('Aureth / Ward the Many (PICK ONE, its own lab): his Light shield 20% stronger on every ally within 4 m',()=>{
  const L=lab(H,S(['mb_5_3']),{foes:2,allies:2}), {v,A}=L; D(L); v.shield=0; V.cast(v,'blue');
  near(A[0].shield,LS(v)*1.2,'within 4 m'); near(A[1].shield,LS(v),'7 m away: the shield as it was'); near(v.shield,LS(v),'himself: as it was');
});

test('Aureth / the hits he takes and his stance stats: Steady Light, Shadow Skin, Root Deep, Grey Hour, Even Light, Lamp Bearer, Patient Light, Calm Centre, Keeper\'s Hide, Mended Plate, Still Room, Even Temper, three moves',()=>{
  const L=lab(H,S(['mb_1_1','hb_11_3','mb_8_4','tb_11_2','mb_11_1','mb_12_2','mb_3_2','tb_10_4','tb_8_4','mb_3_1','mb_4_4','tb_12_4','hb_2_3','mb_5_1','tb_2_2']),{foes:2,allies:2,cold:true,big:true}), {v,A,F}=L;
  const mr0=v.mrRating, ar0=v.armorRating, sp0=v.speed; V.step(1);
  near(v.mrRating,mr0*1.10,'Patient Light: 2% x 5 magic resist in Light'); near(v.armorRating,ar0*1.10,'Keeper\'s Hide: 2% x 5 armor in Light'); near(v.speed,sp0*1.27,'Wide Stance, Light Feet, Both Feet: 3% x 3 each');
  near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*0.94*0.95*0.95*0.95,'in Light: Steady Light 1.2% x 5, Shadow Skin, Root Deep, Grey Hour 1% x 5 each, multiplied');
  near(hitOn(L,v,1000,{kind:'magic'}),plainHit(L,()=>hitOn(L,v,1000,{kind:'magic'}))*0.94*0.95*0.95*0.95*0.925,'Even Light: 1.5% x 5 less magic damage');
  near(hitOn(L,A[0],1000),plainHit(L,()=>hitOn(L,A[0],1000))*0.97,'Lamp Bearer: an ally within 3 m 1% x 3 less'); near(hitOn(L,A[1],1000),plainHit(L,()=>hitOn(L,A[1],1000)),'not 7 m away');
  D(L); near(v.mrRating,mr0*1.10,'Calm Centre: 2% x 5 magic resist in Dark'); near(v.armorRating,ar0,'no Light armor'); near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*0.95*0.95*0.95,'no Steady Light');
  D(L); near(v.armorRating,ar0*1.175,'Mended Plate: turning to Light, 1.5% x 5 armor for 4 s'); secs(4.1); near(v.armorRating,ar0*1.10,'then the Light armor only');
  near(FX.cc(F[0],v,'stunned',1),0.8,'Still Room: controls on him 4% x 5 shorter (20% at most)');
  v.slowMul=0.5; v.slow=2; V.step(1); near(v.slowMul,1-0.5*0.76,'Even Temper: a slow on him 8% x 3 weaker (24% at most)');
});

test('Aureth / his healing: Kind Flash, Bright Hand, Brother of Light',()=>{
  const L=lab(H,S(['mb_4_2','mb_4_3','mb_11_4']),{foes:2,allies:2}), {v,A,F}=L; v.hp=v.maxHp*0.5;
  let h=v.hp; plainHit(L,()=>V.cast(v,'green',v)); const p0=v.hp-h; v.hp=v.maxHp*0.5; h=v.hp; V.cast(v,'green',v); near(v.hp-h,p0+v.maxHp*0.03,'Kind Flash: Sunburst also heals each ally in its reach for 1% x 3 of its max HP (himself too)',1e-6);
  v.hp=v.maxHp; A[0].hp=A[0].maxHp*0.5; A[1].hp=A[1].maxHp*0.2; let a=A[0].hp; const d=swing(L,F[0],'l'); near(A[0].hp-a,d*0.12,'Bright Hand: a light-arm hit heals the lowest-health ally within 5 m for 4% x 3 of the damage',1e-6);
  near(A[1].hp,A[1].maxHp*0.2,'not the lower one 7 m away'); a=A[0].hp; swing(L,F[0],'d'); near(A[0].hp,a,'not the dark arm',1e-9);
  v.hp=v.maxHp*0.5; a=A[0].hp; const b=A[1].hp; V.step(1); near(A[0].hp-a,regen(v)*V.STEP*0.5,'Brother of Light: his Light regeneration heals every ally within 3 m for half as much',1e-6); near(A[1].hp,b,'not 7 m away',1e-9);
  D(L); a=A[0].hp; V.step(1); near(A[0].hp,a,'not in Dark stance',1e-9);
});

test('Aureth / Everything Grows Back (SIGNATURE): an ally within 6 m who would die is healed to 40%, everyone within 6 m Unending 5 s and shares the Overgrowth, then Duality turns him to Dark; once every 30 s',()=>{
  const L=lab(H,S(['mb_13_3','mb_1_4','mb_10_4']),{foes:2,allies:2}), {v,A}=L; const og=stack(L,'og'); assert.ok(og>0); const s0=v.shield||0, a00=A[0].shield||0;
  const a=A[0]; a.hp=100; V.dmg(a,1e12); assert.ok(a.alive,'the ally does not die'); near(a.hp,a.maxHp*0.4,'healed to 40% of its max HP');
  assert.ok(mark(L,a,'un')&&mark(L,v,'un'),'every ally within 6 m Unending (himself too)'); assert.ok(!mark(L,A[1],'un'),'not one 7 m away');
  near(a.shield-a00,og/2,'the Overgrowth split between them as shields'); near(v.shield-s0,og/2,''); assert.equal(stack(L,'og'),0);
  assert.equal(v._darkStance,false,'not inside the blow'); V.step(1); assert.equal(v._darkStance,true,'then Duality turns him to Dark');
  secs(5.1); assert.ok(!mark(L,a,'un'),'5 s'); a.hp=100; V.dmg(a,1e12); assert.ok(!a.alive,'once every 30 s');
});

/* ============================== THE THIRD BROTHER ============================== */
test('Aureth / the Scales: The Scales, Quiet Hours; they tip 1 a second toward his stance and start each wave level',()=>{
  const L=lab(H,S(['tb_1_1','tb_12_2']),{foes:2,big:true}), {v,F}=L; assert.equal(stack(L,'sc'),5,'level');
  near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000))*0.94,'within 1 of level: 2% x 3 less'); near(swing(L,F[0],'l'),plainHit(L,()=>swing(L,F[0],'l'))*1.06,'and 2% x 3 more');
  secs(1.38); assert.equal(stack(L,'sc'),5,'Quiet Hours: 10% x 3 slower (a step every 1.43 s)'); secs(0.08); assert.equal(stack(L,'sc'),6,'toward Light');
  secs(1.45); assert.equal(stack(L,'sc'),7); near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000)),'2 from level: no more');
  D(L); secs(2.9); assert.equal(stack(L,'sc'),5,'toward Dark'); secs(20); assert.equal(stack(L,'sc'),0,'at most 5 Dark');
  V.wave(); V.step(1); assert.equal(stack(L,'sc'),5,'a new wave: level');
});

test('Aureth / Long Pause and Both Fonts: while the Scales sit level',()=>{
  const L=lab(H,S(['tb_8_3']),{foes:2}), {v}=L; v.hp=v.maxHp*0.5; let h=v.hp; V.step(10); near(v.hp-h,(regen(v)+v.maxHp*0.015)*10*V.STEP,'Long Pause: 0.3% x 5 of his max HP a second while exactly level',1e-6);
  setStack(L,'sc',6); h=v.hp; V.step(10); near(v.hp-h,regen(v)*10*V.STEP,'not at 1 from level',1e-6);
  const M=lab(H,S(['tb_10_3']),{foes:2}); noDef(M); const f=M.F[0]; let g=f.hp; M.v.hp=M.v.maxHp*0.5; V.step(1); near(g-f.hp,drain(M.v)*0.30*V.STEP,'Both Fonts in Light: Dark\'s drain too, at 6% x 5',1e-6);
  D(M); M.v.hp=M.v.maxHp*0.5; h=M.v.hp; g=f.hp; V.step(1); near((M.v.hp-h)-(g-f.hp)*0.8,regen(M.v)*0.30*V.STEP,'in Dark: Light\'s regeneration too, at 30% (beside the drain\'s own heal)',1e-3);
  setStack(M,'sc',2); M.v.hp=M.v.maxHp*0.5; h=M.v.hp; g=f.hp; V.step(1); near((M.v.hp-h)-(g-f.hp)*0.8,0,'not 3 from level',1e-3);
});

test('Aureth / Let One Win (PICK ONE, its own lab) with Tipped: at 5 Dark or 5 Light that stance is 25% stronger, the level bonus lost',()=>{
  const L=lab(H,S(['tb_5_2','tb_6_2','tb_1_1']),{foes:3,big:true}), {v,F}=L; free(F[0]); at(L,F[0],2,0);
  near(hitOn(L,v,1000),plainHit(L,()=>hitOn(L,v,1000)),'The Scales\' level bonus is lost');
  D(L); secs(5.1); assert.equal(stack(L,'sc'),0); V.step(1); near(v.dmgBuffMul,1.5,'5 Dark: Duality\'s Dark bonus 25% stronger (1.4 to 1.5)'); near(FX.num(v,'tfDark',100),125,'and the drain');
  near(sun(L,F[0]),plainHit(L,()=>sun(L,F[0]))*1.12,'Tipped: at either end Sunburst 4% x 3 more');
  D(L); assert.ok(!(v.dmgBuffT>0),'into Light: no buff'); secs(1.05); assert.ok(stack(L,'sc')>0); near(FX.num(v,'tfLight',100),100,'');
  secs(10); assert.equal(stack(L,'sc'),10); near(FX.num(v,'tfLight',100),125,'5 Light: the regeneration 25% stronger');
});

test('Aureth / Neither Wins (PICK ONE, its own lab): the Scales never tip more than 2 either way',()=>{
  const L=lab(H,S(['tb_5_3']),{foes:2}); secs(10); assert.equal(stack(L,'sc'),7); D(L); secs(10); assert.equal(stack(L,'sc'),3);
});

test('Aureth / Weighed: Weighed, Heavy Verdict, Weight of Appetite (with Patient Hunger), Measured Blows, Steady Weight, Counterweight, Weighed Down, Weigh Them All, Scales Settle',()=>{
  const L=lab(H,S(['tb_1_4','tb_2_4','tb_n1','hb_1_1','tb_5_1','tb_6_1','tb_7_4','tb_11_4','tb_10_1','tb_12_1']),{foes:3,big:true}), {v,F}=L; const f=F[0], i0=v.atkInterval, s0=f.speed;
  swing(L,f,'l'); assert.ok(!mark(L,f,'wd'),'one arm: not yet'); swing(L,f,'d'); assert.ok(mark(L,f,'wd'),'both arms within 4 s: Weighed'); assert.equal(stack(L,'hun'),1,'Weight of Appetite: with Patient Hunger, 1 Hunger');
  near(swing(L,f,'l'),plainHit(L,()=>swing(L,f,'l'))*1.10*1.08,'Weighed: 2% x 5 more from him; Weight of Appetite: 8% more on his next hit'); near(swing(L,f,'l'),plainHit(L,()=>swing(L,f,'l'))*1.10,'only the next');
  near(swing(L,f,'l',{crit:true}),plainHit(L,()=>swing(L,f,'l',{crit:true}))*1.10*1.08,'Steady Weight: 4% x 2 more critical damage on it');
  near(hitOn(L,v,1000,{src:f}),plainHit(L,()=>hitOn(L,v,1000,{src:f}))*0.95,'Counterweight: 1% x 5 less from a Weighed enemy');
  V.step(1); near(v.atkInterval,i0/1.05,'Measured Blows: 1% x 5 attack speed per Weighed enemy within 5 m'); near(f.speed,s0*0.90,'Weighed Down: it moves 2% x 5 slower');
  secs(5.3); assert.ok(mark(L,f,'wd'),'Heavy Verdict: 4 s + 0.5 x 3'); secs(0.3); assert.ok(!mark(L,f,'wd'),'then not'); V.step(2); near(f.speed,s0,'');
  swing(L,F[2],'l'); swing(L,F[2],'d'); setStack(L,'sc',8); F[2].hp=1; V.dmg(F[2],1e3); assert.ok(!F[2].alive); assert.equal(stack(L,'sc'),6,'Scales Settle: the Scales tip 1 x 2 toward level');
  assert.ok(mark(L,F[1],'wd'),'Weigh Them All: the nearest enemy is Weighed'); secs(4.9); assert.ok(mark(L,F[1],'wd'),'for 1 s x 5'); secs(0.2); assert.ok(!mark(L,F[1],'wd'));
});

test('Aureth / Weight of Appetite keeps Hunger through a turn to Light for 4 s',()=>{
  const L=lab(H,S(['tb_n1','hb_1_1','tb_1_4']),{foes:2,big:true}), {F}=L; D(L); for(let i=0;i<4;i++) swing(L,F[1],'l'); swing(L,F[0],'l'); swing(L,F[0],'d');
  assert.equal(stack(L,'hun'),7,'6 hits in Dark and 1 for the Weigh'); D(L); assert.equal(stack(L,'hun'),7,'leaving Dark within 4 s: kept');
  D(L); secs(4.1); D(L); assert.equal(stack(L,'hun'),0,'later: it empties');
});

test('Aureth / each switch: Found Wanting, Middle Path; Noon and Midnight; Same Flash',()=>{
  const L=lab(H,S(['tb_3_4','tb_5_4','tb_9_1','tb_6_4','tb_1_4']),{foes:3,big:true}), {v,F}=L; noDef(L); for(const x of F) free(x);
  swing(L,F[0],'l'); swing(L,F[0],'d'); v.hp=v.maxHp*0.5; const h=v.hp, f0=F[0].hp, f1=F[1].hp; V.cast(v,'blue'); const atk=v.dmg*v.dmgBuffMul; V.step(1);
  near(f0-F[0].hp,0.5*atk*1.10*VMX('rageMul'),'Found Wanting: each switch strikes every Weighed enemy within 5 m for 50% of his attack (Weighed: 10% more)',2e-2);
  near(F[1].hp,f1,'not one that is not Weighed',1e-9); assert.ok(v.hp-h>=v.maxHp*0.03-1,'Middle Path: 0.6% x 5 of his max HP each switch');
  setStack(L,'sc',1); at(L,F[1],4,1.5); V.cast(v,'ult'); assert.ok(mark(L,F[1],'wd'),'Noon and Midnight: every enemy Eclipse hits is Weighed'); assert.equal(stack(L,'sc'),5,'and the Scales set level');
  at(L,F[0],2,0); at(L,F[1],0,2); v.hp=v.maxHp*0.5; const g=v.hp; const p=plainHit(L,()=>{ const a=v.hp; V.cast(v,'green',F[0]); return v.hp-a; }); v.hp=g; V.cast(v,'green',F[0]); near(v.hp-g,p+v.maxHp*0.06,'Same Flash: Sunburst heals him 1% x 3 of his max HP for each enemy it hits (2)',1e-6);
});

test('Aureth / Hold Both with Every Weight: Duality cast within 1 of level gives both stances for 3 s',()=>{
  const L=lab(H,S(['tb_11_3','tb_12_3']),{foes:2,allies:1,big:true}), {v,A,F}=L; A[0].shield=0; V.cast(v,'blue'); V.step(1);
  assert.equal(v._darkStance,true); near(A[0].shield,LS(v),'into Dark: the Light shield as well'); near(swing(L,F[0],'l'),plainHit(L,()=>swing(L,F[0],'l'))*1.10,'Every Weight: 2% x 5 more while it runs');
  secs(1.0); V.cast(v,'blue'); assert.equal(v._darkStance,false); near(v.dmgBuffMul,1.4,'into Light: the Dark buff as well'); assert.ok(v.dmgBuffT>2.9&&v.dmgBuffT<=3,'for 3 s');
  secs(3.1); assert.ok(!(v.dmgBuffT>0)); near(swing(L,F[0],'l'),plainHit(L,()=>swing(L,F[0],'l')),'');
  setStack(L,'sc',8); V.cast(v,'blue'); V.step(1); assert.ok(!win(L,'hb'),'not 3 from level');
});

test('Aureth / Third of Three (SIGNATURE): a hit on a Weighed enemy while exactly level opens 5 s of both stances, every hit Weighs, a half Sunburst each second; then the Scales tip 5',()=>{
  const L=lab(H,S(['tb_13_3','tb_1_4']),{foes:3,big:true}), {v,F}=L; noDef(L); at(L,F[0],2,0); swing(L,F[0],'l'); swing(L,F[0],'d');
  assert.ok(win(L,'tot'),'the empty room opens'); near(v.dmgBuffMul,1.4,'Duality\'s Dark buff in Light stance'); assert.ok(v.dmgBuffT>4);
  swing(L,F[1],'l'); assert.ok(mark(L,F[1],'wd'),'every hit Weighs');
  const f0=F[0].hp, f2=F[2].hp; v.hp=v.maxHp*0.5; for(let i=0;i<Math.round(1.0/V.STEP);i++){ at(L,F[0],2,0); V.step(1); }
  const flash=v.apow*1.4*VMX('skillMul')(10)*1.4*0.5*VMX('rageMul'); assert.ok(f0-F[0].hp>=flash*0.999,'each second Sunburst\'s damage at half strength (and the drain on the nearest): '+(f0-F[0].hp)+' >= '+flash);
  near(F[2].hp,f2,'not 15 m away',1e-9);
  secs(4.1); assert.ok(!win(L,'tot')); assert.equal(stack(L,'sc'),10,'when it ends the Scales tip 5 toward Light'); assert.ok(!(v.dmgBuffT>0),'and the Dark buff ends');
  setStack(L,'sc',5); swing(L,F[1],'l'); swing(L,F[1],'d'); assert.ok(!win(L,'tot'),'once every 25 s');
});

/* ============================== WHOLE FIGHTS ============================== */
const units=()=>VMX('units');
test('Aureth: the mechanics act in a live fight, and whole fights are deterministic (twice, through a snap round-trip, both sides)',()=>{
  const list=S(['hb_1_1','hb_1_4','hb_2_1','mb_1_3','mb_1_4','mb_10_4','tb_1_1','tb_1_4','tb_n1']), TEAM=['vael','sylthaine','vireo','vex','aureth'];
  const U=V.arena(snaps(TEAM.map(k=>Object.assign(spec(k,100,k===H?list:null),{skillLv:[100,100,100,100]}))),snaps(TEAM.map(k=>spec(k,100))),4), s=U.find(u=>u.key===H); assert.ok(s._tal); assert.ok(U.filter(u=>u!==s).every(u=>!u._tal));
  const mx={}, mn={}; let wd=false, q=0, un=false, arms={};
  for(let i=0;i<2600&&!V.ended()&&s.alive;i++){ V.step(1); const T0=s._tal.s; for(const k in T0.k){ mx[k]=Math.max(mx[k]||0,T0.k[k].n); mn[k]=Math.min(mn[k]==null?99:mn[k],T0.k[k].n); } arms[s._atkArm]=1;
    for(const f of units()){ const o=f._talM&&f._talM[s.uid]; if(!o) continue; if(o.wd&&o.wd.until>V.now()) wd=true; if(o.un&&o.un.until>V.now()) un=true; if(o['#quiet']&&o['#quiet'].until>V.now()) q=Math.max(q,o['#quiet'].v); } }
  assert.ok(mx.hun>=3,'real hits in Dark stance fed Hunger: '+mx.hun); assert.ok(q>=2,'real hits made enemies Quiet: '+q); assert.ok(wd,'real swings of both arms Weighed an enemy'); assert.ok(un,'real Light shields made allies Unending');
  assert.ok(mx.og>0,'Overgrowth stored: '+mx.og); assert.ok(mx.sc!==mn.sc,'the Scales tipped: '+mn.sc+'..'+mx.sc); assert.ok(arms.attackLight&&arms.attackDark,'both arms swung');
  determinism(H,TEAM);
});

/* The page sites his talents added (the 'num' hook at Twin Fonts' drain and at its Light regeneration, the bindMore line): with nothing learned, whole seeded
   fights with Aureth in the line-up are identical to the pre-talent page (ee8edab8), seed by seed. tests/talents-fight.test.js does the same for line-ups without him. */
const BASE_SHA=process.env.TALENT_BASE||'9f1c2762f837a56a68e9315f7c0cab83a9f8ea2f';
function baseHost(){ const SH=require(path.join(root,'server/sim-host.js')), dir=fs.mkdtempSync(path.join(os.tmpdir(),'ew-talent-base-'));
  fs.writeFileSync(path.join(dir,'emberweave-heroes.html'),cp.execFileSync('git',['-C',root,'show',BASE_SHA+':emberweave-heroes.html'],{maxBuffer:1<<28}));
  for(const f of fs.readdirSync(root)) if(/\.(js|json)$/.test(f)&&!/^talents/.test(f)&&fs.statSync(path.join(root,f)).isFile()&&fs.statSync(path.join(root,f)).size<5e6) fs.copyFileSync(path.join(root,f),path.join(dir,f));
  fs.cpSync(path.join(root,'server'),path.join(dir,'server'),{recursive:true}); return SH.load(path.join(dir,'emberweave-heroes.html')); }
let BASE=null; try{ BASE=baseHost(); }catch(e){ console.log('BASE page not available ('+String(e.message||e).slice(0,120)+') - the identity check against it is skipped'); }
test('Aureth: no talents - whole fights with him in the line-up are identical to the pre-talent page, and they reach every site his talents added',{skip:!BASE},()=>{
  const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), team=['aureth','vael','vireo','sylthaine','gruel'], foeTeam=['bloatus','fritz','dandra','konwu','ceraline'];
  const sn=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(team.map(k=>spec(k,70))))), a=sn(NOW), b=sn(BASE); assert.deepEqual(a,b);
  VMX('var __auN={dark:0,light:0,dual:0}; var __auD=_doEffectCore, __auS=SKLV.twinfonts, __auC=dealDamage;'+
    'SKLV.twinfonts=function(){ __auN.light++; return __auS.apply(this,arguments); };'+
    'dealDamage=function(s,t,a,c,k,si){ if(s&&s.key==="aureth"&&c==="#b06bff") __auN.dark++; return __auC.apply(this,arguments); };'+
    '_doEffectCore=function(u,type,o){ if(u&&u.key==="aureth"&&type==="duality") __auN.dual++; return __auD.apply(this,arguments); };');
  let n=0; try{ for(const node of [12,34,60,90]) for(const seed of [7,1000007,987654]){ const w=ENC.find(e=>e.node===node).waves;
      const f=(h,x)=>{ const r=h.campaign(JSON.parse(JSON.stringify(x)),w,seed,[[0,'auto',-1,1,null,null]]); return JSON.stringify([r.won,r.stars,r.digest]); };
      assert.equal(f(NOW,a),f(BASE,b),'campaign node '+node+' seed '+seed); n++; }
    const fo=h=>JSON.parse(JSON.stringify(h.snapFromSpecs(foeTeam.map(k=>spec(k,68)))));
    for(const seed of [5,77,31337]){ const g=(h,x,y)=>JSON.stringify(h.auto(JSON.parse(JSON.stringify(x)),JSON.parse(JSON.stringify(y)),seed));
      assert.equal(g(NOW,a,fo(NOW)),g(BASE,b,fo(BASE)),'two-sided fight seed '+seed); assert.equal(g(NOW,fo(NOW),a),g(BASE,fo(BASE),b),'him on the other side, seed '+seed); n+=2; }
    const c=VMX('__auN'); /* talents RC: the Light count was required to exceed the Dark count; after v1391's base changes the seeded fights split 19,067 Dark / 18,707 Light - the check is that BOTH sites ran */ assert.ok(c.dark>100&&c.light-c.dark>100&&c.dual>0,'the fights drained in Dark stance ('+c.dark+'), regenerated in Light ('+(c.light-c.dark)+') and cast Duality ('+c.dual+'): every new site was run'); }
  finally{ VMX('_doEffectCore=__auD; SKLV.twinfonts=__auS; dealDamage=__auC;'); }
  assert.ok(n>=18);
});

/* Phil, 14 Nov: nobody ever above 95% damage reduction, and a build that sits at that ceiling (or is immune) for more than half a battle is too strong.
   His damage reduction talents (and armor / magic resist / max HP), each candidate build at 91 points legal; the most defensive one is the one whose worst hit is reduced most. */
const DEF={ hb:['hb_9_1','hb_11_3','hb_6_4','hb_5_1','hb_8_1','hb_2_1'],
            mb:['mb_1_1','mb_8_4','mb_11_1','mb_3_1','mb_3_2','mb_5_4','mb_9_2','mb_4_4'],
            tb:['tb_1_1','tb_7_4','tb_11_2','tb_8_4','tb_10_4','tb_1_4','tb_13_3'] };
function defensive(order){ let b={r:{}}; const want=[].concat(...order.map(k=>DEF[k])), meta=id=>T.talent(H,id);
  const pre=id=>{ const p=meta(id).prereq; return p?pre(p).concat([p]):[]; }, goals=[]; for(const id of want) for(const x of pre(id).concat([id])) if(goals.indexOf(x)<0) goals.push(x);
  for(let g=0;g<3000&&T.spent(H,b).total<91;g++){ const id=goals.find(x=>(b.r[x]|0)<meta(x).ranks&&T.canLearn(H,b,x,100));
    if(id){ b=T.learn(H,b,id,100).build; continue; }
    const open=goals.find(x=>(b.r[x]|0)<meta(x).ranks), tree=open?meta(open).treeIdx:null;
    const pool=T.trees(H).map((tr,i)=>tr.talents.filter(t=>(tree==null||i===tree)&&!meta(t[0]).lock&&T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1]||x[2]-y[2]);
    const any=pool[0]||T.trees(H).map(tr=>tr.talents.filter(t=>T.canLearn(H,b,t[0],100))).flat().sort((x,y)=>x[1]-y[1])[0]; if(!any) break; b=T.learn(H,b,any[0],100).build; }
  return b; }
/* the worst hit on him: every condition of his damage-reduction talents true at once (the attacker is Weighed with 5 Quiet; he is at full Hunger, the Scales sit
   exactly level, Third of Three's window is open (both stances: Steady Light and the Dark ones together), Mended Plate is up), as a normal hit and as a critical one */
function worstHit(list,kind,crit){ const L=lab(H,list,{foes:3,cold:true}), {v,F}=L; V.step(1); const f=F[0];
  if(L.T){ const M=x=>(x._talM||(x._talM={}))[v.uid]||(x._talM[v.uid]={}); M(f)['#quiet']={v:5,until:1e9}; M(f).wd={t0:0,until:1e9,v:0};
    for(const w of ['tot','mp']) L.T.s.w[w]={t:99,n:1,cdT:0,at:-1,wave:false}; setStack(L,'hun',16); setStack(L,'sc',5); v._darkStance=true; }
  V.step(1); if(L.T){ setStack(L,'hun',16); setStack(L,'sc',5); } v.maxHp=1e5; v.hp=4e4; v.shield=1e12; v.shieldT=999;
  const raw=1e6, x=lost(v,()=>V.hit(f,v,raw,{kind,crit})), cm=crit?1+Math.max(0,(f.critDmg||0.6)-(v.critRes||0)):1; return 1-x/(raw*cm*VMX('elemMul')(f,v)); }
test('Aureth: his most defensive legal 91-point build never takes more than 95% off a hit, and never sits at that ceiling (or immune) in a seeded fight',()=>{
  const cands=[['hb','mb','tb'],['mb','tb','hb'],['tb','mb','hb'],['mb','hb','tb'],['tb','hb','mb']].map(o=>{ const b=defensive(o); assert.equal(T.invalid(H,b,100),'','a legal build'); assert.equal(T.spent(H,b).total,91); return {o,b,list:T.learned(H,b)}; });
  for(const c of cands){ c.worst=0; for(const kind of ['magic','phys']) for(const crit of [false,true]) c.worst=Math.max(c.worst,worstHit(c.list,kind,crit)); }
  const best=cands.slice().sort((a,b)=>b.worst-a.worst)[0], none=Math.max(...['magic','phys'].map(k=>worstHit(null,k,false)));
  assert.ok(best.worst>none+0.05,'(the talents do reduce it: '+best.worst.toFixed(3)+' against '+none.toFixed(3)+' with none)');
  assert.ok(best.worst<0.95,'the worst possible hit on his most defensive build ('+best.o.join(' > ')+') is reduced by '+(best.worst*100).toFixed(1)+'%: below 95%');
  VMX('var __dr={max:0,n:0,at:0,imm:0,ticks:0,hi:0}; var __ddc=_dealDamageCore, __ubc=_updateBattleCore;'+
    '_dealDamageCore=function(src,tgt,amt,color,kind,silent){ const me=tgt&&tgt.key==="aureth"&&src&&src.team!==tgt.team; let h0=0; if(me){ h0=tgt.hp+(tgt.shield||0); tgt._critHit=false; } const r=__ddc.apply(this,arguments);'+
    '  if(me&&amt>0&&tgt.alive&&!tgt._critHit){ const l=h0-tgt.hp-(tgt.shield||0), raw=amt*elemMul(src,tgt); if(raw>0&&l>0){ const d=1-l/raw; __dr.n++; if(d>__dr.max) __dr.max=d; if(d>=0.95) __dr.at++; if(d>=0.85) __dr.hi++; } } return r; };'+
    '_updateBattleCore=function(dt){ for(const u of units){ if(u&&u.key==="aureth"&&u.alive){ __dr.ticks++; if(HERO61.immune(u,battleTime)) __dr.imm++; } } return __ubc.apply(this,arguments); };');
  try{ const sn=snaps(['vael','sylthaine','vireo','vex','aureth'].map(k=>Object.assign(spec(k,100,k===H?best.list:null),{skillLv:[100,100,100,100]})));
    for(const [node,seed] of [[34,11],[60,90210],[90,424242],[120,7]]) campaign(sn,node,seed);
    const foe=snaps(['vex','nox','rafe','sloe','fritz'].map(k=>Object.assign(spec(k,100),{skillLv:[100,100,100,100]})));
    for(const seed of [3,5,8,13]) NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),seed);
    const d=VMX('__dr'); console.log('  95% check: most defensive build '+best.o.join(' > ')+' ('+JSON.stringify(T.spent(H,best.b).tree)+'), worst possible hit '+(best.worst*100).toFixed(1)+'% (no talents '+(none*100).toFixed(1)+'%); seeded fights: '+d.n+' hits, the most reduced '+(d.max*100).toFixed(1)+'%, 85% or more '+d.hi+', at the ceiling '+d.at+', immune ticks '+d.imm+' of '+d.ticks);
    assert.ok(d.n>50&&d.ticks>500,'hits on him: '+d.n);
    assert.ok(d.max<0.95,'no hit on him was reduced by 95% or more (the most: '+(d.max*100).toFixed(1)+'%)'); assert.equal(d.at,0,'so he never sits at the ceiling'); assert.equal(d.imm,0,'and he is never immune'); }
  finally{ VMX('_dealDamageCore=__ddc; _updateBattleCore=__ubc;'); }
});
