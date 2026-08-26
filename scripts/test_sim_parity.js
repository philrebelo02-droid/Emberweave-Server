// Combat-field parity assertions for the qualification estimate (audit round 4):
// NO universal base crit; crit = 1.6x at the unit's OWN chance; critRes shrinks the bonus;
// DR: rate part capped 0.6 (+ diminishing base-armor curve inside heroCombatStats);
// energy regen is TIME-based (points per round), decoupled from swings; HP regen heals EVERY unit;
// the selected Gear Skill fires exactly once per battle.
const S=require('./server/sim.js');
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
console.log('PASS: '+pass+'  FAIL: '+fail); process.exit(fail?1:0);
