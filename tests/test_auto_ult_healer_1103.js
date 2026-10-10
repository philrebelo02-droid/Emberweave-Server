// v1103 (Phil 9 Oct, Emberdraft: "they dont auto ult. i still have to click" / "it was vireo"): a healer's AUTO ult waited for the first point
// of ally damage. Vireo's Grand Symphony, Lumi's Sunburst and Mellan's Hive Mind also damage enemies, so with an untouched team they sat
// full until the player clicked. Those three fire as soon as they are full; First Spring (Oakmir) and Rally (Dandra) only heal and still wait.
const fs = require('fs'), path = require('path'), vm = require('vm');
const page = fs.readFileSync(path.join(__dirname, '..', 'emberweave-heroes.html'), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
const set = page.match(/const HEALER_ULT_HITS=new Set\((\[[^\]]*\])\)/);
ok(set && JSON.stringify(JSON.parse(set[1].replace(/'/g, '"')).sort()) === JSON.stringify(['hivemind', 'sunburst', 'symphony']), 'the healer ults that also hit enemies: Symphony, Sunburst, Hive Mind');
// the real condition line, run with stub units
const line = page.match(/\n(\s*const _ultDmg=HEALER_ULT_HITS\.has\(u\.abilityOverride\|\|u\.t\.ability\);[^\n]*)\n\s*if\(auto && !ultBlockedReason\(u\) && \((!u\.t\.healer\|\|_ultDmg\|\|alliesOf\(u\)\.some\(a=>a\.hp<a\.maxHp\))\)\)\{/);
ok(!!line, 'the AUTO condition reads the set');
if (line) {
  const fires = (ability, healer, hurt) => vm.runInNewContext('const HEALER_ULT_HITS=new Set(' + set[1] + ');' + line[1] + '\n; (' + line[2] + ')',
    { u: { t: { ability, healer } }, alliesOf: () => [{ hp: hurt ? 50 : 100, maxHp: 100 }] });
  ok(fires('symphony', true, false), 'Vireo (Symphony) fires with nobody hurt');
  ok(fires('sunburst', true, false) && fires('hivemind', true, false), 'Lumi (Sunburst) and Mellan (Hive Mind) fire with nobody hurt');
  ok(!fires('firstspring', true, false) && !fires('rally', true, false), 'control: Oakmir (First Spring) and Dandra (Rally) still wait while nobody is hurt');
  ok(fires('firstspring', true, true), 'control: a heal-only ult fires once an ally is hurt');
  ok(fires('worldweight', false, false), 'a non-healer fires as before');
}
console.log('test_auto_ult_healer_1103.js: ' + pass + ' checks passed' + (fail ? ', ' + fail + ' FAILED' : ''));
process.exit(fail ? 1 : 0);
