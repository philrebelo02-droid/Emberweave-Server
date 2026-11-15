'use strict';
/* The 95% damage-reduction ceiling (Phil, 14 Nov 2026: "The biggest thing, no one in the game should ever be over 95% damage reduction, also if
   they reach that for longer than 50% of a battle they are too OP").
   (a) the hard ceiling, on a still-field lab unit: reductions stacked far past 95% still let 5% of the hit through, on every path (a hit, a DoT
       tick, a plain damage() call, the line model); shields, dodges, misses and immunity are untouched; a reduction under the ceiling is unchanged.
   (b) the balance test: each wired hero's most defensive legal 91-point builds (91 in one tree, or 61 + a 30-point dip, preferring every talent
       that reduces damage) fight a set of seeded fights; none may spend more than half of a battle at the ceiling or immune (tests/dr-ceiling.js).
   Run: node --test tests/balance-dr-ceiling.test.js */
require('node:os').setPriority(process.pid,require('node:os').constants.priority.PRIORITY_LOW);   /* this PC is shared: long fights at low priority */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const L=require('./talents-lab.js'), {NOW,FX,FXN,T,V,spec,snaps,near,lab,lost,root}=L;
const DRC=require('./dr-ceiling.js'), W=DRC.watch(NOW);
const R=code=>vm.runInContext(code,NOW.ctx);

/* ------------------------------------------------ (a) the hard ceiling ------------------------------------------------ */
test('the ceiling: reductions stacked past 95% still take 5% of the hit; under 95% nothing changes',()=>{
  const {v,F}=lab('vael',null,{foes:1}), f=F[0];
  for(const u of [v,f]){ u.maxHp=u.hp=1e9; u.shield=0; }
  const plain=lost(v,()=>V.hit(f,v,1000,{kind:'true'})); near(plain,1000,'a true hit on a unit with no reduction');
  v.glyphDR=0.5; near(lost(v,()=>V.hit(f,v,1000,{kind:'true'})),500,'50% reduction: unchanged (under the ceiling)');
  v.drMul=0.12; v.drT=10; near(lost(v,()=>V.hit(f,v,1000,{kind:'true'})),60,'94% reduction: unchanged');
  v.drMul=0.02; near(lost(v,()=>V.hit(f,v,1000,{kind:'true'})),50,'99% reduction: the unit still loses 5% of the hit');
  v.drMul=1e-6; near(lost(v,()=>V.hit(f,v,1000,{kind:'true'})),50,'almost total reduction: still 5%');
  /* armor counts: a physical hit is measured before the armor too */
  v.drMul=1; v.drT=0; v.glyphDR=0; const sa=v.armorRating; v.armorRating=1e9; near(lost(v,()=>V.hit(f,v,1000,{kind:'phys'})),50,'armor alone near 100%: 5%');
  v.glyphDR=0.9; v.drMul=0.1; v.drT=10; near(lost(v,()=>V.hit(f,v,1000,{kind:'phys'})),50,'armor x glyph x skill reduction combined: 5% of the hit before any of them');
  v.armorRating=sa; v.glyphDR=0; v.drMul=1; v.drT=0;
  /* a DoT tick and a plain damage() call */
  v.glyphDR=0.99; const d=lost(v,()=>{ V.dot(v,1000,1,1,f); for(let i=0;i<40;i++) V.step(1); }); near(d,50,'a DoT tick: 5% of the tick');
  near(lost(v,()=>V.dmg(v,1000)),50,'a plain damage() call (talent damage, a percent-of-HP strike): 5% of its own amount');
  { const sa=v.armorRating; v.armorRating=1e9; v.glyphDR=0.5; const pd=R('pushDot'); const g=lost(v,()=>{ pd(v,1000,1,1,'#8f8fa8',f,'phys'); for(let i=0;i<40;i++) V.step(1); }); v.armorRating=sa;
    near(g,50,'a physical DoT tick on near-total armor: 5% of the tick before the armor'); }
  v.glyphDR=0;
});

test('the ceiling leaves shields, dodges, misses, evades and immunity as they are',()=>{
  const {v,F}=lab('vael',null,{foes:1}), f=F[0]; v.maxHp=v.hp=1e9; v.glyphDR=0.99;
  v.shield=10000; const hp0=v.hp; V.hit(f,v,1000,{kind:'true'}); assert.equal(v.hp,hp0,'a shield soaks the (floored) hit whole'); assert.equal(v.shield,10000-50,'and pays only the 5% that got through');
  v.shield=0; v.evaStat=1; const e0=v.hp; V.hit(f,v,1000,{kind:'phys'}); assert.equal(v.hp,e0,'an Evasion miss stays a miss'); v.evaStat=0;
  v._evadeT=5; const e1=v.hp; V.hit(f,v,1000,{kind:'phys'}); assert.equal(v.hp,e1,'an evade window stays a full evade'); v._evadeT=0;
  v._noTarget=true; const e2=v.hp; V.hit(f,v,1000,{kind:'true'}); assert.equal(v.hp,e2,'untargetable: nothing'); v._noTarget=false;
  v._openGateImmuneUntil=V.now()+5; const e3=v.hp; V.hit(f,v,1000,{kind:'true'}); V.dmg(v,1000); assert.equal(v.hp,e3,'an immune unit (the Open Gate) takes nothing'); v._openGateImmuneUntil=0;
  v.glyphDR=0;
});

test('the ceiling and talents: incoming rows count as reduction, a divert is not reduction, "cannot be hurt" stays immunity',()=>{
  const def={talents:{tx_in:[{on:'in',less:0.999}], tx_div:[{on:'teamIn',if:{srcTeam:'enemy',targetTeam:'ally'},divert:1}], tx_imm:[{on:'teamIn',if:{srcTeam:'enemy',targetTeam:'ally'},mul:0}]},states:{},ruling:{}};
  try{
    let Lb=lab('vael',[['tx_in',1]],{def,foes:1}); let {v,F}=Lb; v.maxHp=v.hp=1e9; v.glyphDR=0;
    near(lost(v,()=>V.hit(F[0],v,1000,{kind:'true'})),50,'a talent that takes 99.9% off: 5% still lands');
    v.glyphDR=0.5; near(lost(v,()=>V.hit(F[0],v,1000,{kind:'true'})),50,'with other reductions on top: still 5% of the hit before all of them');
    Lb=lab('vael',[['tx_div',1]],{def,foes:1,allies:1}); ({v,F}=Lb); const A=Lb.A[0]; v.maxHp=v.hp=A.maxHp=A.hp=1e9; v.glyphDR=0; A.glyphDR=0;
    const a=lost(A,()=>{ const b=lost(v,()=>V.hit(F[0],A,1000,{kind:'true'})); near(b,1000,'the whole hit moved onto the talented unit'); }); near(a,0,'a divert of 100% leaves the ally nothing: moved, not reduced');
    Lb=lab('vael',[['tx_imm',1]],{def,foes:1,allies:1}); const B=Lb.A[0]; B.maxHp=B.hp=1e9; B.glyphDR=0;
    near(lost(B,()=>V.hit(Lb.F[0],B,1000,{kind:'true'})),0,'a talent that makes the hit deal nothing (The Quiet Snow\'s ice) stays immunity');
  } finally{ FX.define('vael',null); }
  assert.equal(FX.errors().n,0,FX.errors().last);
});

test('the combining rule: sources of damage reduction multiply (each takes its share of what is left), never add',()=>{
  const def={talents:{tx_a:[{on:'in',less:0.5}], tx_b:[{on:'in',less:0.5}]},states:{},ruling:{}};
  try{ const {v,F}=lab('vael',[['tx_a',1],['tx_b',1]],{def,foes:1}); v.maxHp=v.hp=1e9; v.glyphDR=0;
    near(lost(v,()=>V.hit(F[0],v,1000,{kind:'true'})),250,'two 50% talent sources: 75% in all, not 100%');
    v.glyphDR=0.5; near(lost(v,()=>V.hit(F[0],v,1000,{kind:'true'})),125,'with a 50% glyph reduction: 87.5%');
    v.drMul=0.5; v.drT=10; near(lost(v,()=>V.hit(F[0],v,1000,{kind:'true'})),62.5,'with a 50% skill reduction (Last Stand\'s slot): 93.75%');
    v.drMul=0.2; near(lost(v,()=>V.hit(F[0],v,1000,{kind:'true'})),50,'and past 95% the floor holds: 5%'); v.drMul=1; v.drT=0; v.glyphDR=0;
  } finally{ FX.define('vael',null); }
});

test('the ceiling in the line model (Arena, Skyfall, the Trial, NPC castles): the same 5%',()=>{
  const CC=require(path.join(root,'server/combat-core.js')); assert.equal(typeof CC.applyDamage,'function','combat-core exports applyDamage');
  const mk=o=>Object.assign({key:'vael',level:100,hp:1e9,maxHp:1e9,armor:0,mr:0,block:0,dmgRed:0,eva:0,crit:0,shieldPool:0,energy:0,_drR:0},o);
  const rnd=()=>0.99, log=[];
  near(CC.applyDamage(rnd,log,1,'A',mk({}),mk({dmgRed:0.5}),1000,'true',{}),500,'under the ceiling: unchanged');
  near(CC.applyDamage(rnd,log,1,'A',mk({}),mk({dmgRed:0.6,_drR:1,armor:1e9}),1000,'phys',{}),50,'armor x brace x Damage Reduction past 95%: 5%');
});

/* ------------------------------------------------ (b) the balance test ------------------------------------------------ */
/* a talent that reduces damage taken (or makes its holder immune): read from its own rows */
function defensive(hero){ const M=FXN.mech(hero), out=new Set();
  const deep=(x,f)=>{ if(!x||typeof x!=='object') return false; if(f(x)) return true; for(const k in x) if(deep(x[k],f)) return true; return false; };
  for(const id in M.talents) for(const row of M.talents[id]){ const ev=[].concat(row.on||[]);
    if((ev.includes('in')||ev.includes('teamIn'))&&(row.less!=null||(row.mul!=null&&row.mul<1)||row.divert!=null)) out.add(id);
    if(row.stat&&(row.stat.armor>0||row.stat.mr>0||(row.stat.armor&&row.stat.armor.r>0)||(row.stat.mr&&row.stat.mr.r>0))) out.add(id);
    if(deep(row.do,x=>x.undying!=null||x.atOne!=null||x.untarget!=null||x.miss)) out.add(id); }
  return out; }
function defBuild(hero,plan,R){ let b={r:{}}; const trees=T.trees(hero);
  const need=new Set(); for(const id of R){ let t=T.talent(hero,id); while(t&&t.prereq){ need.add(t.prereq); t=T.talent(hero,t.prereq); } }
  const locksR=t=>t[7]&&R.has(t[7]);
  for(const [ti,pts] of plan){ const tr=trees[ti];
    for(let g=0;g<600&&T.spent(hero,b).tree[tr.id]<pts&&T.spent(hero,b).total<91;g++){
      const c=tr.talents.filter(t=>T.canLearn(hero,b,t[0],100)); if(!c.length) break;
      const sc=t=>(R.has(t[0])?0:need.has(t[0])?1:locksR(t)?3:2);
      c.sort((a,z)=>sc(a)-sc(z)||a[1]-z[1]||a[2]-z[2]); b=T.learn(hero,b,c[0][0],100).build; } }
  assert.equal(T.invalid(hero,b,100),'',hero+' build is legal'); return b; }
function plans(hero){ const n=T.trees(hero).length, out=[]; for(let m=0;m<n;m++){ out.push([[m,91]]); for(let d=0;d<n;d++) if(d!==m) out.push([[m,61],[d,30]]); } return out; }
const HEROES=FXN.mechHeroes().filter(h=>T.has(h)).sort();
const TEAM=['vael','sylthaine','vireo','vex','gruel'];
const STRONG={hp:40000,atk:600,apow:600,armor:300,mr:300,dmgRed:600,block:600,critRes:500,crit:300,critDmg:400,lifesteal:200,eva:300,acc:300,ctrlRes:400,healPow:400,shieldStr:400,defense:300};
const strong=(key,talents)=>Object.assign(spec(key,100,talents,16),{stars:5,pips:5,tt:Object.assign({},STRONG),fAtk:2000,fHp:30000,fApow:2000,techArmor:800,techMr:800,techHeal:300,ex:{techCrit:300,techCritRes:300,techHeal:300,equip:{}}});
const ENC=JSON.parse(fs.readFileSync(path.join(root,'server/campaign-encounters.json'),'utf8')), WAVES=n=>ENC.find(e=>e.node===n).waves;
const RESULTS=[];
function share(hero,list,mk,only){ const team=[hero].concat(TEAM.filter(k=>k!==hero).slice(0,4)), sn=snaps(team.map(k=>mk(k,k===hero?list:null)));
  const foe=snaps(['tharl','hobb','rhukk','aureth','calypsa'].map(k=>mk(k,null))); let worst=0, at='';
  const runs=[['camp 140',()=>NOW.campaign(JSON.parse(JSON.stringify(sn)),WAVES(140),11,[[0,'auto',-1,1,null,null]])],
              ['camp 160',()=>NOW.campaign(JSON.parse(JSON.stringify(sn)),WAVES(160),4242,[[0,'auto',-1,1,null,null]])],
              ['vs line-up',()=>NOW.auto(JSON.parse(JSON.stringify(sn)),JSON.parse(JSON.stringify(foe)),77)]];
  for(const [name,run] of runs.filter(r=>process.env.DR_FULL||only.includes(r[0]))){ W.start(u=>u.team==='ally'&&u.key===hero&&!!u._tal); run(); const r=W.stop();
    for(const e of r) if(e.share>worst){ worst=e.share; at=name+' ('+e.ceil.toFixed(1)+' s at the ceiling, '+e.imm.toFixed(1)+' s immune of '+e.t.toFixed(1)+' s)'; } }
  return {worst,at}; }
for(const hero of HEROES) test('balance: '+hero+'\'s most defensive 91-point builds spend at most half of a battle at the 95% ceiling or immune',()=>{
  const R=defensive(hero); if(hero==='vael') R.add('ib_7_2');   /* Sanguine Hide: named by the owner's brief (it trades Last Stand's reduction for a shield) */
  assert.ok(R.size>0,hero+' has damage-reduction talents');
  const trees=T.trees(hero).map(t=>t.name);
  for(const plan of plans(hero)){ const b=defBuild(hero,plan,R), list=T.learned(hero,b), name=plan.map(([t,p])=>trees[t]+' '+p).join(' + ');
    const got=[...R].filter(id=>b.r[id]).length;
    for(const [tier,mk,only] of [['lab spec',(k,l)=>spec(k,100,l),['camp 160']],['strong gear',strong,['vs line-up']]]){ const r=share(hero,list,mk,only);   /* kept light (it runs in the suite): one fight per build and gear tier; DR_FULL=1 runs all three */
      RESULTS.push([hero,name,tier,got,r.worst,r.at]);
      assert.ok(r.worst<=0.5,hero+' '+name+' ('+tier+'): '+(r.worst*100).toFixed(1)+'% of a battle at the ceiling or immune - '+r.at); } }
  assert.equal(FX.errors().n,0,FX.errors().last);
});
test.after(()=>{ if(process.env.DR_REPORT) for(const r of RESULTS) console.log(['DR',r[0],r[1],r[2],'reduction talents '+r[3],(r[4]*100).toFixed(1)+'%',r[5]].join(' | ')); });
