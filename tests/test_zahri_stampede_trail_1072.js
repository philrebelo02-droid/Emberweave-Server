// v1072 - Noonday Stampede flame trail (Grok, Phil-approved 8 Oct, spell 17): head pinned on Zahri, streak stretched from her
// start point to her, behind her, burning away from the start over 2 s after she arrives. Static checks; look checked on the rig.
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
const H = fs.readFileSync(path.join(R, 'emberweave-heroes.html'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };

for (const k of ['stampbody', 'stamphead']) {
  const m = H.match(new RegExp('\\n\\s*' + k + ":\\{u:'([^']+)',n:1,"));
  ok(m && fs.existsSync(path.join(R, m[1].split('?')[0])), k + ' sheet defined and on disk');
}
ok(/u\._abilHold=Math\.max\(u\._abilHold\|\|0,u\._stampT\+0\.3\);[^\n]*\n\s*if\(typeof spawnStampTrail==='function'\) spawnStampTrail\(u\);/.test(H), 'the trail starts with the stampede cast');
const fn = H.slice(H.indexOf('function updateStampFx'), H.indexOf('function updateUnitFx'));
ok(/const tx=o\.x0\+\(o\.hx-o\.x0\)\*f/.test(fn), 'the tail starts at the start point and burns toward her');
ok(/head\.visible=running;/.test(fn), 'the head cuts off when the run ends');
ok(/Math\.min\(1,o\.burn\/2\.0\)/.test(fn), 'burn-out lasts 2 s');
ok(/mk\(tb,'stampbody',-2\), head=mk\(th,'stamphead',-1\)/.test(H), 'drawn behind her');
ok(/function updateUnitFx\(dt\)\{ try\{ updateStampFx\(dt\); \}catch\(e\)\{\}/.test(H), 'ticked with the unit FX');
ok(/_stampFx\.forEach\(o=>\{ try\{ o\.sprs\.forEach/.test(H), 'cleared with the other FX');
ok(!/dealDamage|\.hp\s*[-+]?=|_stampT\s*[-+]?=|battleTime\s*=/.test(fn), 'CONTROL: display only - the run (_stampT) and damage are untouched');

console.log('\nPASS: ' + pass + '  FAIL: ' + fail);
process.exit(fail ? 1 : 0);
