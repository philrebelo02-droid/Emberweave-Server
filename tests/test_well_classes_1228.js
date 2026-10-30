// v1228 (Phil 30 Oct 2026: "in starless well, there is warrior buffs but we dont have warriors, thats meant to be bruisers"):
// the Well's blessing classes are the game's own six roles, every hero role lands in its own class, and a 'Warrior:*' buff
// saved before the rename still works (as the Bruiser buff).
const path = require('path');
const root = path.join(__dirname, '..');
const W = require(path.join(root, 'server', 'starless-well.js'));
const { HERO_BASE } = require(path.join(root, 'server', 'sim.js'));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok  ' + m); } else { fail++; console.log('  FAIL ' + m); } };

const classes = [...new Set(W.BUFFS.map(b => b.cls))].filter(c => c !== 'All').sort();
ok(JSON.stringify(classes) === JSON.stringify(['Assassin', 'Bruiser', 'Mage', 'Marksman', 'Support', 'Tank']), 'the blessing classes are the six roles: ' + classes.join(', '));
ok(!W.BUFFS.some(b => /Warrior/.test(b.cls + b.label)), 'no blessing says Warrior');
const roles = [...new Set(Object.values(HERO_BASE).map(h => h.role))];
ok(roles.every(r => classes.includes(r)), 'every hero role has its own blessings (' + roles.join(', ') + ')');
ok(W.BUFFS.filter(b => b.cls === 'Bruiser').map(b => b.label).join(' | ') === 'Bruiser heroes +6% HP | Bruiser heroes +5% attack | Bruiser heroes +8% armor and magic resist', 'Bruisers get the same three blessings as every class');
console.log('test_well_classes_1228.js: ' + pass + ' checks passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
