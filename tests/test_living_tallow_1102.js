// v1102 (Phil 9 Oct): "living tallow needs to start 1 second encase and it upgrades .015 per upgrade". Runs the page's own
// tallowEncase + waxOnCaster: the third coat on a caster encases (stun + silence) for 1 s + 0.015 s per Living Tallow level.
const fs = require('fs'), path = require('path'), vm = require('vm');
const page = fs.readFileSync(path.join(__dirname, '..', 'emberweave-heroes.html'), 'utf8');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
const i = page.indexOf('function tallowEncase('), j = page.indexOf('/* v542', i);
ok(i > 0 && j > i, 'tallowEncase and waxOnCaster found');
function run(lv, ctrlRes) {
  const ctx = { units: [], floatTexts: [], ccDur: x => x, ringBurst() {}, Math };
  vm.runInNewContext(page.slice(i, j) + '\nthis.T=tallowEncase; this.W=waxOnCaster;', ctx);
  const her = { alive: true, team: 'a', pass: { tallow: true }, skillLv: [1, 1, 1, lv] }, c = { alive: true, team: 'b', ctrlRes: ctrlRes || 0 };
  ctx.units.push(her, c); ctx.W(c); ctx.W(c); const before = c.stunned || 0; ctx.W(c);
  return { T: ctx.T, before, stun: c.stunned, sil: c.silencedT };
}
const a = run(1), b = run(11), z = run(1, 0.5);
ok(Math.abs(a.T(1) - 1.0) < 1e-9 && Math.abs(a.T(2) - 1.015) < 1e-9 && Math.abs(a.T(11) - 1.15) < 1e-9, 'encase time: 1.0 s at level 1, +0.015 s per level (1.15 s at level 11)');
ok(a.before === 0 && Math.abs(a.stun - 1.0) < 1e-9 && Math.abs(a.sil - 1.0) < 1e-9, 'level 1: the third coat stuns and silences for 1.0 s (control: the first two do not)');
ok(Math.abs(b.stun - 1.15) < 1e-9, 'level 11: 1.15 s');
ok(Math.abs(z.stun - 0.5) < 1e-9, 'control resistance still shortens it (50 % -> 0.5 s)');
ok(/tallow:'\{i:s:stun\} '\+\(\+tallowEncase\(lv\)\.toFixed\(3\)\)/.test(page), 'the skill card shows the same number the fight uses');
console.log('test_living_tallow_1102.js: ' + pass + ' checks passed' + (fail ? ', ' + fail + ' FAILED' : ''));
process.exit(fail ? 1 : 0);
