// v1315 (Phil 8 Nov 2026): Leviath "this is meant to be a caster bruiser" / Volthex "what makes you think this is a warrior" / "its clearly a mage" /
// "audit the game.. you made grave errors in judgement". Every monster and boss has a real game class (MON_CLASS) and the damage type that goes with
// its kit. CONTROL: the v1314 build (git show 6a80d24a) still had Warrior / Brute labels and Leviath on Attack Damage.
const fs = require('fs'), path = require('path'), cp = require('child_process'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let P = 0, F = 0;
const ck = (n, c, x) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n + (x !== undefined ? ' - ' + JSON.stringify(x) : '')); } };
const load = f => require(path.join(ROOT, 'server', 'sim-host.js')).load(f);
const NEW = load(path.join(ROOT, 'emberweave-heroes.html'));
const oldFile = path.join(ROOT, '.test-1315-cls.html');
fs.writeFileSync(oldFile, cp.execSync('git show 6a80d24a:emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }));
process.on('exit', () => { try { fs.unlinkSync(oldFile); } catch (e) {} });
const OLD = load(oldFile);
const R = (h, c) => vm.runInContext(c, h.ctx);
const cls = h => JSON.parse(R(h, `JSON.stringify((()=>{ const o={}; for(const k in MONSTER_TYPES){ const t=MONSTER_TYPES[k]; if(t&&t.monster) o[k]=[t.role,t.damageProfile,monsterRow(k)]; } return o; })())`));
const n = cls(NEW), o = cls(OLD), keys = Object.keys(n);
const GAME = ['Tank', 'Bruiser', 'Mage', 'Marksman', 'Support'];
ck('every monster and boss (' + keys.length + ') has a game class (Tank / Bruiser / Mage / Marksman / Support)', keys.length > 70 && keys.every(k => GAME.includes(n[k][0])), keys.filter(k => !GAME.includes(n[k][0])));
ck('every one is in MON_CLASS (nothing falls back to the old label rule)', R(NEW, `Object.keys(MONSTER_TYPES).filter(k=>MONSTER_TYPES[k]&&MONSTER_TYPES[k].monster&&!MON_CLASS[k]).length`) === 0);
ck('no Assassin monster (the backline dive stays a hero mechanic)', keys.every(k => n[k][0] !== 'Assassin'));
ck('Leviath: Bruiser, Ability Power (a caster bruiser), front line', n.leviath[0] === 'Bruiser' && n.leviath[1] === 'Magic' && n.leviath[2] !== 'back', n.leviath);
ck('Volthex: Mage, Ability Power, back line', n.volthex[0] === 'Mage' && n.volthex[1] === 'Magic' && n.volthex[2] === 'back', n.volthex);
ck('Magmourn stays a mage tank', n.magmourn[0] === 'Tank' && n.magmourn[1] === 'Magic', n.magmourn);
ck('Brukk / Vharok / Orryx: Bruiser, Attack Damage', ['brukk', 'vharok', 'orryx'].every(k => n[k][0] === 'Bruiser' && n[k][1] === 'Attack'));
ck('every Mage is Ability Power', keys.filter(k => n[k][0] === 'Mage').every(k => n[k][1] === 'Magic'));
const card = id => R(NEW, `glStatsHtml(${JSON.stringify(id)},'bosses')`);
ck('Leviath card: Ability Power, Front line', card('leviath').includes(R(NEW, `ewT('hero.stat_apow')`)) && card('leviath').includes(R(NEW, `ewT('gloss.front_line')`)));
ck('Volthex card: Ability Power, Back line', card('volthex').includes(R(NEW, `ewT('hero.stat_apow')`)) && card('volthex').includes(R(NEW, `ewT('gloss.back_line')`)));
ck('CONTROL: v1314 had Warrior / Brute labels and Leviath on Attack, Volthex a Warrior', keys.some(k => o[k] && /^(Warrior|Brute)$/.test(o[k][0])) && o.leviath[1] === 'Attack' && o.volthex[0] === 'Warrior', { leviath: o.leviath, volthex: o.volthex });
console.log('test_monster_class_1315.js: ' + P + ' passed, ' + F + ' failed');
process.exit(F ? 1 : 0);
