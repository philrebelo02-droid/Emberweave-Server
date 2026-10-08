// v1071 - Deep Roots spell art (Grok, Phil-accepted 8 Oct): the roots cage grows from the ROOTED ally's feet for the 4 s heal.
// Static checks on the wiring; the look was checked on the rig (Zahri rooted at 25%: cage at 0.55 s and 1.5 s, gone at the end, 50% hp).
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
const H = fs.readFileSync(path.join(R, 'emberweave-heroes.html'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };

const def = H.match(/\n\s*oakroots:\{u:'([^']+)',n:(\d+),fw:(\d+),fh:(\d+),cols:(\d+),rows:(\d+),dur:([\d.]+),anchor:\[[\d.]+,[\d.]+\],cageH:[\d.]+\}/);
ok(def, 'FX2_DEF has the oakroots sheet with its feet anchor');
const file = def && def[1].split('?')[0];
ok(file && fs.existsSync(path.join(R, file)), 'the sheet exists on disk (' + file + ')');
ok(def && +def[2] <= +def[5] * +def[6] && +def[3] * +def[5] <= 4096 && +def[4] * +def[6] <= 4096, 'grid holds n and fits the 4096 texture limit');
ok(def && Math.abs(+def[2] / 24 - 4) < 0.05, 'one play = 4 s at 24 fps, the length of the Deep Roots heal');
ok(/o\._drUsed=true;[\s\S]{0,200}?ringBurst\(o\.x,o\.y,0x6FCF5A,10\); if\(typeof spawnUnitFx==='function'\) spawnUnitFx\(o,'oakroots'\);/.test(H), 'spawned on the rooted ally (o), at the moment Deep Roots triggers');
ok(/spr\.renderOrder=1;/.test(H.slice(H.indexOf('function spawnUnitFx'), H.indexOf('function updateUnitFx'))), 'drawn in front of the unit (the cage is hollow)');
ok(/updateTipFx\(dt\); updateUnitFx\(dt\); \}catch\(e\)\{\}/.test(H) && /updateStatusFx\(dt\); updateTipFx\(dt\); updateUnitFx\(dt\);/.test(H), 'ticked in battle and after the end');
ok(/_unitFx\.forEach\(o=>\{ try\{ scene\.remove\(o\.spr\)/.test(H), 'cleared with the other FX');
const body = H.slice(H.indexOf('function spawnUnitFx'), H.indexOf('function updateUnitFx') + 900);
ok(!/dealDamage|\.hp\s*[-+]?=|_drRate|_drLeft|battleTime\s*=/.test(body), 'CONTROL: display only - the heal (_drRate/_drLeft) is untouched');

console.log('\nPASS: ' + pass + '  FAIL: ' + fail);
process.exit(fail ? 1 : 0);
