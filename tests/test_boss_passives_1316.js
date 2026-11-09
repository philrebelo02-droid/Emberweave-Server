// v1316 (Phil 8 Nov 2026: "do everything you think is best", on three bosses whose card said one thing and the fight did nothing):
// Sable Vesper's Dirge Crescendo healed 0 (a Magic monster with no apow read apB = 0); Maelvara's Fury (+25% attack speed) set a flag nothing
// read on a boss; the Nameless Admiral's Pack Stats counted summons he never has -> he takes Lifesteal. CONTROL: live v1315 (git show c09b0412).
const fs = require('fs'), path = require('path'), cp = require('child_process'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let P = 0, F = 0;
const ck = (n, c, x) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n + (x !== undefined ? ' - ' + JSON.stringify(x) : '')); } };
const load = f => require(path.join(ROOT, 'server', 'sim-host.js')).load(f);
const NEW = load(path.join(ROOT, 'emberweave-heroes.html'));
const oldFile = path.join(ROOT, '.test-1316-boss.html');
fs.writeFileSync(oldFile, cp.execSync('git show c09b0412:emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }));
process.on('exit', () => { try { fs.unlinkSync(oldFile); } catch (e) {} });
const OLD = load(oldFile);
const R = (h, c) => JSON.parse(vm.runInContext(c, h.ctx));
const heal = h => R(h, `(function(){ units.length=0; const m=makeUnit('sable vesper','enemy',900,700,30,{owned:false}); const b=makeUnit('vireo','enemy',950,700,30,{owned:false});
  b.hp=b.maxHp*0.3; units.push(m,b); const h0=b.hp; m._castSM=1; m._castLv=1;
  _doEffectCore(m,'crescendo',Object.assign({},MONSTER_KITS['sable vesper'].green,{_arrived:true})); return JSON.stringify({healed:b.hp-h0, ap:monSkillStat(m)}); })()`);
const hn = heal(NEW), ho = heal(OLD);
ck('Sable Vesper Dirge Crescendo heals each ally 200% of her Ability Power (card)', Math.abs(hn.healed - 2 * hn.ap) < 1, hn);
ck('CONTROL: live v1315 healed 0', ho.healed === 0, ho);
const units = h => R(h, `(function(){ units.length=0; const m=makeUnit('maelvara','enemy',900,700,30,{owned:false}), a=makeUnit('nameless admiral','enemy',900,700,30,{owned:false});
  return JSON.stringify({mi:m.atkInterval, ap:a.pass}); })()`);
const un = units(NEW), uo = units(OLD);
ck('Maelvara Fury: attack interval / 1.25 (= +25% attack speed, card)', Math.abs(un.mi * 1.25 - uo.mi) < 1e-6, [un.mi, uo.mi]);
ck('Nameless Admiral has Lifesteal (Pack Stats needed summons he never has)', un.ap && un.ap.lifesteal === true && !un.ap.packstats, un.ap);
ck('CONTROL: live v1315 Admiral had Pack Stats', uo.ap && uo.ap.packstats === true, uo.ap);
const card = R(NEW, `JSON.stringify(glPassLine('nameless admiral', MONSTER_KITS['nameless admiral'].pass))`);
ck('his Glossary card shows the Lifesteal line', /20%/.test(card) && !/summon/i.test(card), card);
console.log('test_boss_passives_1316.js: ' + P + ' passed, ' + F + ' failed');
process.exit(F ? 1 : 0);
