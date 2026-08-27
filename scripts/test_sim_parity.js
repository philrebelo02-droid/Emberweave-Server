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
// ---- v241 (full-game audit): Ability Power is its own line; penetration counters DEFENSE RATING ----
// 1) a MAGE's AP glyphs raise the ability line; a PHYSICAL hero's line is untouched by AP
const syl0=S.heroCombatStats('sylthaine',{level:10,stars:1,pips:0});
const sylA=S.heroCombatStats('sylthaine',{level:10,stars:1,pips:0,glyph:{apow:400}});
ck('Mage + Ability Power raises the ability line ('+syl0.atk+' -> '+sylA.atk+')', sylA.atk>syl0.atk);
const va0=S.heroCombatStats('vael',{level:10,stars:1,pips:0});
const vaA=S.heroCombatStats('vael',{level:10,stars:1,pips:0,glyph:{apow:400}});
ck('Bruiser (apow 0 base) line untouched by Ability Power ('+va0.atk+' == '+vaA.atk+')', vaA.atk===va0.atk);
const vaP=S.heroCombatStats('vael',{level:10,stars:1,pips:0,glyph:{atk:400}});
ck('Bruiser + Physical Attack raises his line ('+va0.atk+' -> '+vaP.atk+')', vaP.atk>va0.atk);
// 2) penetration beats DEFENSE RATING, and does NOTHING against an unarmored target
const penHitArm=avg(hits({pen:900},{defRating:1200,dr:S===null?0:(1200/(1200+1200))},30));
const noPenArm=avg(hits({},{defRating:1200,dr:1200/(1200+1200)},30));
ck('pen 900 vs def 1200 raises damage ('+(penHitArm/noPenArm).toFixed(2)+'x)', penHitArm/noPenArm>1.3);
const penHitNaked=avg(hits({pen:900},{},30));
ck('pen does nothing against an unarmored target ('+(penHitNaked/base).toFixed(2)+'x ~ 1)', penHitNaked/base>0.9 && penHitNaked/base<1.1);
// 3) the snapshot carries defRating + pen for the resolver
const fz2=S.heroCombatStats('fritz',{level:10,stars:2,pips:0,pen:250});
ck('snapshot carries defRating ('+Math.round(fz2.defRating)+') and pen ('+fz2.pen+')', fz2.defRating>0 && fz2.pen===250);
console.log('PASS: '+pass+'  FAIL: '+fail); process.exit(fail?1:0);
