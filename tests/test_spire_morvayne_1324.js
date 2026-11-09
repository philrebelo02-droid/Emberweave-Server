// v1324 (Phil 9 Nov 2026): "Morvayne is wrong in spire. He should be swinging his mace for attacks hes not a caster. Also his heal abilities and ult
// shield should be on himself not randomly. The fx should follow him not just land randomly". In the battle game Morvayne (hero61) is a Support at
// range 200 whose art lands on the ally he protects; in the Spire he is melee and his own only ally. CONTROL: live v1322 (git show 4eccf066).
const fs = require('fs'), path = require('path'), cp = require('child_process'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let P = 0, F = 0;
const ck = (n, c, x) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n + (x !== undefined ? ' - ' + JSON.stringify(x) : '')); } };
const load = f => require(path.join(ROOT, 'server', 'sim-host.js')).load(f);
const kitsOf = h => JSON.parse(vm.runInContext('JSON.stringify(Object.fromEntries(Object.keys(HERO_TYPES).map(hk=>[hk,(()=>{const k=survivorsKit(hk); return k&&{melee:k.melee,reach:k.reach,skills:(k.skills||[]).map(s=>({kind:s.kind,fx:(s.fx||[]).map(e=>e.at+":"+e.kind)})),ult:k.ult&&(k.ult.fx||[]).map(e=>e.at+":"+e.kind)};})()])))', h.ctx));
const NEW = kitsOf(load(path.join(ROOT, 'emberweave-heroes.html')));
const oldFile = path.join(ROOT, '.test-1324-morv.html'); fs.writeFileSync(oldFile, cp.execSync('git show 4eccf066:emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }));
process.on('exit', () => { try { fs.unlinkSync(oldFile); } catch (e) {} });
const OLD = kitsOf(load(oldFile));
const m = NEW.hero61, o = OLD.hero61;
ck('Morvayne swings his mace in the Spire (melee)', m.melee === true);
ck('King\'s Mercy heals him and Shelter of the Crown shields him (heal / ward, not an enemy nova)', m.skills[0].kind === 'heal' && m.skills[1].kind === 'ward', m.skills);
ck('every piece of his spell and ult art stands on him and follows him (self, never target)', [...m.skills.flatMap(s => s.fx), ...m.ult].every(x => /^self:/.test(x)), m);
ck('no other hero\'s Spire kit changed', Object.keys(NEW).filter(k => k !== 'hero61' && JSON.stringify(NEW[k]) !== JSON.stringify(OLD[k])).length === 0, Object.keys(NEW).filter(k => k !== 'hero61' && JSON.stringify(NEW[k]) !== JSON.stringify(OLD[k])));
ck('CONTROL: v1322 had him ranged, casting novas at enemies', o.melee === false && o.skills.every(s => s.kind === 'nova') && o.ult.every(x => /^target:/.test(x)));
console.log('test_spire_morvayne_1324.js: ' + P + ' passed, ' + F + ' failed');
process.exit(F ? 1 : 0);
