// v1074 - Rewrite the Pattern (Linnet ult, Grok spell 18, Phil-accepted 8 Oct): Grok's gold thread swirl plays over EVERY
// ally the rewind touches - the revived too - small, above the head. Static checks on the wiring; rig: 4 allies incl. a
// revived Sloe each got a swirl (scale 1.84-2.05), seen at ~1 s and ~2 s over their heads.
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
const H = fs.readFileSync(path.join(R, 'emberweave-heroes.html'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };

const def = H.match(/\n\s*linnet_rewind:\{u:'([^']+)',n:(\d+),fw:(\d+),fh:(\d+),cols:(\d+),rows:(\d+),dur:([\d.]+),upright:true,upAbove:true,[^}]*upSize:([\d.]+)/);
ok(def, 'FX2_DEF has linnet_rewind as an above-the-head plate');
const file = def && def[1].split('?')[0];
ok(file && fs.existsSync(path.join(R, file)), 'the sheet exists on disk (' + file + ')');
ok(def && +def[2] <= +def[5] * +def[6] && +def[3] * +def[5] <= 4096 && +def[4] * +def[6] <= 4096, 'grid holds n and fits the 4096 texture limit');
ok(def && Math.abs(+def[7] - 6.04) < 0.01, 'plays the clip\'s full 6.04 s');
ok(def && +def[8] <= 0.6, 'small (upSize ' + (def && def[8]) + ')');
const c = H.slice(H.indexOf("case 'rewind':{"), H.indexOf("case 'plumage':{"));
ok(/const _rw=\[\];/.test(c) && /if\(h==null\)return;[^\n]*\r?\n\s*_rw\.push\(a\);/.test(c), 'every ally the rewind touches is collected (the fallen too)');
ok(/_rw\.forEach\(a=>\{ if\(!a\.alive\) return;/.test(c) && c.indexOf('_rw.forEach') > c.indexOf("txt:'REWOVEN'"), 'the swirl spawns after the revive, so the revived get it where they come back');
ok(/spawnGroundFx\('linnet_rewind',a\.x,a\.y,1\.2\*METER,6\.04\)/.test(c) && /fo\.followAbove=a;/.test(c), 'one swirl per ally, riding its head');
ok(/finally\{ _fxAllow=false; window\._fxTgtH=null; window\._fxTgtU=null; window\._fxAboveBar=false; \}/.test(c), 'the FX globals are reset after');
// CONTROL: display only - the heal/revive maths are the v894 lines, unchanged
ok(/if\(h>a\.hp\)\{ healFrom\(u,a,h-a\.hp\);/.test(c) && /a\.hp=Math\.max\(1,Math\.min\(worldHealCap\(a\),h\*\(o\.revive\|\|0\.4\)\)\);/.test(c), 'CONTROL: the heal and revive are unchanged');
const fxPart = c.slice(c.indexOf('_rw.forEach'));
ok(!/healFrom|\.hp\s*=|alive\s*=\s*true|energy\s*=/.test(fxPart.slice(0, fxPart.indexOf('floatTexts'))), 'CONTROL: the swirl code touches no hp, life or energy');

console.log('\nPASS: ' + pass + '  FAIL: ' + fail);
process.exit(fail ? 1 : 0);
