// Combat-field parity assertions for the qualification estimate (audit round 4):
// NO universal base crit; crit = 1.6x at the unit's OWN chance; critRes shrinks the bonus;
// DR: rate part capped 0.6 (+ diminishing base-armor curve inside heroCombatStats);
// energy regen is TIME-based (points per round), decoupled from swings; HP regen heals EVERY unit;
// the selected Gear Skill fires exactly once per battle.
const S=require(require('fs').existsSync(__dirname+'/server/sim.js')?'./server/sim.js':'../server/sim.js');   // v229: works from a flat bundle or from scripts/ in a repo checkout
let pass=0,fail=0; const ck=(n,c)=>{ c?(pass++,console.log('  ✓ '+n)):(fail++,console.log('  ✗ '+n)); };
const mk=(o)=>Object.assign({key:'x',role:'Bruiser',healer:false,maxHp:100000,atk:100,heal:0,speed:1,dr:0,crit:0,critRes:0,energyReg:0,regen:0,gearSkillSlot:null},o);
function hits(att,def,n){ const out=[];
  for(let seed=1;seed<=n;seed++){ const a=S.makeLine([mk(att)]), b=S.makeLine([mk(Object.assign({atk:1},def))]);
    const r=S.resolveLineBattle(a,b,seed);
    for(const e of r.log){ if(e[1]==='A'&&e[3]==='>'&&!e[6]) out.push(e[5]); } }
  return out; }
const avg=x=>x.reduce((s,v)=>s+v,0)/Math.max(1,x.length);
const base=avg(hits({},{},30));
ck('NO universal base crit: zero-crit units never crit (max/base < 1.35)', Math.max(...hits({},{},30))/ (base/1.075) < 1.5*0.95 );
const drHit=avg(hits({},{dr:0.6},30));
ck('DR 0.6 cuts damage to ~40% ('+(drHit/base).toFixed(2)+')', drHit/base>0.34 && drHit/base<0.46);
const critHit=avg(hits({crit:1},{},30));
ck('guaranteed crit ≈ 1.6× ('+(critHit/base).toFixed(2)+')', critHit/base>1.5 && critHit/base<1.7);
const cresHit=avg(hits({crit:1},{critRes:0.5},30));
ck('critRes 0.5 halves the crit bonus (~1.3×, got '+(cresHit/base).toFixed(2)+')', cresHit/base>1.2 && cresHit/base<1.4);
// TIME-based energy: a fast (2-swing) unit and a slow unit with the same energyReg gain the same regen per round
function firstUltRound(att){ const a=S.makeLine([mk(att)]), b=S.makeLine([mk({maxHp:10000000,atk:1})]);
  const r=S.resolveLineBattle(a,b,7); for(const e of r.log){ if(e[1]==='A'&&e[6]) return e[0]; } return 999; }
ck('energyReg (25 pts/s) charges the ult sooner ('+firstUltRound({energyReg:25})+' < '+firstUltRound({})+')', firstUltRound({energyReg:25})<firstUltRound({}));
ck('energy regen decoupled from attack speed (fast unit same reg rounds)', firstUltRound({energyReg:25,speed:1.2})<=firstUltRound({energyReg:25}));
// universal HP regen: a NON-healer bruiser with regen survives longer than without
function survRounds(def){ const a=S.makeLine([mk({atk:800})]), b=S.makeLine([mk(Object.assign({maxHp:20000,atk:1},def))]);
  const r=S.resolveLineBattle(a,b,11); return r.rounds; }
ck('HP regen heals a NON-healer ('+survRounds({regen:0.02})+' > '+survRounds({})+' rounds survived)', survRounds({regen:0.02})>survRounds({}));
// gear skill: Helm shield makes the defender survive longer (one-use absorb pool)
function defRounds(def){ const a=S.makeLine([mk({atk:800})]), b=S.makeLine([mk(Object.assign({maxHp:20000,atk:1},def))]);
  const r=S.resolveLineBattle(a,b,13); return r.rounds; }
ck('Helm gear skill absorbs damage ('+defRounds({gearSkillSlot:'Helm'})+' > '+defRounds({})+' rounds)', defRounds({gearSkillSlot:'Helm'})>defRounds({}));
// base armor: fritz carries defToDR(base) — dr>0 with zero rate stats
const fz=S.heroCombatStats('fritz',{level:10,stars:2,pips:0});
ck('fritz base armor/MR reaches dr via defToDR ('+fz.dr.toFixed(3)+')', fz.dr>0.05 && fz.dr<0.5);
const va=S.heroCombatStats('vael',{level:10,stars:1,pips:0});
ck('heroes without base armor have dr 0', va.dr===0);
// ==== v242 COMBAT CORE — the audit's acceptance tests (typed damage, separate pens) ====
const C=S.CORE, rr=C.mulberry32(7), lg=[];
const T=o=>Object.assign({key:'t',role:'Bruiser',healer:false,maxHp:1e6,hp:1e6,energy:0,atkP:0,atkM:0,heal:0,speed:1,
  armor:0,mr:0,armorPen:0,magicPen:0,crit:0,critDmg:0.6,critRes:0,energyReg:0,startEnergy:0,regen:0,
  lifesteal:0,eva:0,acc:0,block:0,dmgBonus:1,dmgRed:0,haste:1,shieldStr:1,ctrlHit:0,ctrlRes:0,healPow:0,shieldPool:0},o);
const hitK=(src,tgt,kind)=>{ const t=T(tgt); C.applyDamage(C.mulberry32(11),[],1,'A',T(src),t,10000,kind,{noCrit:true,noDodge:true}); return 1e6-t.hp; };
// 1. Mage + Ability Power raises the ABILITY line, never a physical hero's line
const sylA=S.heroCombatStats('sylthaine',{level:10,ratings:{apowFlat:400}});
const syl0=S.heroCombatStats('sylthaine',{level:10});
ck('1a Mage + AP raises the ability line ('+syl0.atkM+' -> '+sylA.atkM+')', sylA.atkM===syl0.atkM+400);
const vaA=S.heroCombatStats('vael',{level:10,ratings:{apowFlat:400}});
const va0b=S.heroCombatStats('vael',{level:10});
ck('1b Bruiser gains NOTHING from AP ('+va0b.atk+' == '+vaA.atk+')', vaA.atk===va0b.atk && vaA.atkM===0);
ck('1c Bruiser + Physical Attack raises his line', S.heroCombatStats('vael',{level:10,ratings:{atkFlat:400}}).atkP===va0b.atkP+400);
// 2. Magic Penetration beats high MR — and does nothing against Armor
const vsMR=hitK({},{mr:1200},'magic');
const vsMRpen=hitK({magicPen:1200},{mr:1200},'magic');
ck('2a magic vs MR1200 halved ('+vsMR+')', vsMR>4800&&vsMR<5200);
ck('2b Magic Pen restores it ('+vsMRpen+')', vsMRpen===10000);
ck('2c ARMOR Pen does NOT help vs MR', hitK({armorPen:1200},{mr:1200},'magic')===vsMR);
ck('2d Magic Pen does NOT help vs Armor', hitK({magicPen:1200},{armor:1200},'phys')===hitK({},{armor:1200},'phys'));
// 3. physical mirror + block is PHYSICAL-only
const vsAR=hitK({},{armor:1200},'phys');
ck('3a phys vs Armor1200 halved ('+vsAR+')', vsAR>4800&&vsAR<5200);
ck('3b Armor Pen restores it', hitK({armorPen:1200},{armor:1200},'phys')===10000);
(function(){ let blocked=0; for(let seed=1;seed<=40;seed++){ const t=T({block:0.30}); C.applyDamage(C.mulberry32(seed),[],1,'A',T({}),t,10000,'phys',{noCrit:true,noDodge:true}); if(1e6-t.hp<10000) blocked++; }
  let blockedM=0; for(let seed=1;seed<=40;seed++){ const t=T({block:0.30}); C.applyDamage(C.mulberry32(seed),[],1,'A',T({}),t,10000,'magic',{noCrit:true,noDodge:true}); if(1e6-t.hp<10000) blockedM++; }
  ck('3c block halves SOME physical hits ('+blocked+'/40) and NO magical hits ('+blockedM+'/40)', blocked>3 && blockedM===0); })();
// 4. a Marksman keeps physical scaling while taking pure utility
const mer0=S.heroCombatStats('meridian',{level:10});
const merU=S.heroCombatStats('meridian',{level:10,ratings:{hpFlat:800,armor:100,regen:50}});
ck('4 Marksman + HP/def utility keeps his physical line ('+mer0.atkP+')', merU.atkP===mer0.atkP && merU.maxHp===mer0.maxHp+800 && merU.armor>mer0.armor);
// 5. deterministic event log with typed kinds — same seed, byte-identical battle
(function(){ const mkTeam=()=>S.makeLine([S.heroCombatStats('vael',{level:12}),S.heroCombatStats('sylthaine',{level:12}),S.heroCombatStats('vireo',{level:12})]);
  const foe=()=>S.makeLine([S.heroCombatStats('grosk',{level:12}),S.heroCombatStats('umbris',{level:12})]);
  const r1=S.resolveLineBattle(mkTeam(),foe(),12345), r2=S.resolveLineBattle(mkTeam(),foe(),12345);
  ck('5a same seed → byte-identical result + event log', JSON.stringify(r1)===JSON.stringify(r2));
  const kinds=new Set(r1.log.map(e=>e[7]).filter(Boolean));
  ck('5b event log carries typed kinds ('+[...kinds].join(',')+')', kinds.has('phys'));
  ck('5c the log is animatable: every entry names round/side/actor/verb/target', r1.log.every(e=>e.length>=6)); })();
console.log('PASS: '+pass+'  FAIL: '+fail); process.exit(fail?1:0);
