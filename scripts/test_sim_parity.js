// Gear/glyph combat-field parity assertions against the sim resolver (re-audit round 3):
// DR capped at 0.6 and multiplicative on incoming damage; crit = 1.6x at (0.12+crit) chance;
// critRes shrinks the crit BONUS; energy speeds ult charge. Deterministic seeds.
const S=require('./server/sim.js');
let pass=0,fail=0; const ck=(n,c)=>{ c?(pass++,console.log('  ✓ '+n)):(fail++,console.log('  ✗ '+n)); };
const mk=(o)=>Object.assign({key:'x',role:'Bruiser',healer:false,maxHp:100000,atk:100,heal:0,speed:1,dr:0,crit:0,critRes:0,energyReg:0},o);
function avgHit(att,def,n){ let tot=0,cnt=0;
  for(let seed=1;seed<=n;seed++){ const a=S.makeLine([mk(att)]), b=S.makeLine([mk(Object.assign({atk:1},def))]);
    const r=S.resolveLineBattle(a,b,seed); // read damage from the log: entries [round,side,key,'>',tgt,dmg,ult]
    for(const e of r.log){ if(e[1]==='A'&&e[3]==='>'&&!e[6]){ tot+=e[5]; cnt++; if(cnt>=40) break; } } if(cnt>=40*seed) continue; }
  return tot/Math.max(1,cnt); }
const base=avgHit({},{},30);
const drHit=avgHit({},{dr:0.6},30);
ck('DR 0.6 cuts damage to ~40% ('+(drHit/base).toFixed(2)+')', drHit/base>0.34 && drHit/base<0.46);
const drOver=avgHit({},{dr:5},30);
ck('DR capped at 0.6 even when overfed', Math.abs(drOver-drHit)/drHit<0.05);
const critHit=avgHit({crit:0.88},{},30);   // 100% crit chance (0.12+0.88)
ck('guaranteed crit ≈ 1.6× ('+(critHit/base).toFixed(2)+')', critHit/base>1.5 && critHit/base<1.7);
const cresHit=avgHit({crit:0.88},{critRes:0.5},30);
ck('critRes 0.5 halves the crit bonus (~1.3×, got '+(cresHit/base).toFixed(2)+')', cresHit/base>1.2 && cresHit/base<1.4);
// energy: unit with energyReg reaches its first ult strictly sooner
function firstUltRound(att){ const a=S.makeLine([mk(att)]), b=S.makeLine([mk({maxHp:10000000,atk:1})]);
  const r=S.resolveLineBattle(a,b,7); for(const e of r.log){ if(e[1]==='A'&&e[6]) return e[0]; } return 999; }
ck('energyReg charges the ult sooner ('+firstUltRound({energyReg:1})+' < '+firstUltRound({})+')', firstUltRound({energyReg:1})<firstUltRound({}));
console.log('PASS: '+pass+'  FAIL: '+fail); process.exit(fail?1:0);
