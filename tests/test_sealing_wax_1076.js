// v1076 - Sealing Wax (Ceraline green, Grok spell 20, Phil-approved 8 Oct): molten wax erupts from under the target's feet to
// about half its height, then a bubbling wax pool stays under its feet for the wax coat (_waxCoatT), gone when the coat ends
// or Mourning Bell shatters it. Rig: tick waxed - column at ~mid-body at 2.7 s, pool after the eruption, removed at coat end.
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
const H = fs.readFileSync(path.join(R, 'emberweave-heroes.html'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };

const er = H.match(/\n\s*waxerupt:\{u:'([^']+)',n:(\d+),fw:(\d+),fh:(\d+),cols:(\d+),rows:(\d+),dur:([\d.]+),anchor:\[[\d.]+,[\d.]+\],peakFrac:([\d.]+),peakH:([\d.]+)\}/);
const po = H.match(/\n\s*waxpool:\{u:'([^']+)',n:(\d+),fw:(\d+),fh:(\d+),cols:(\d+),rows:(\d+),dur:([\d.]+)\}/);
for (const [m, k] of [[er, 'eruption'], [po, 'pool']]) {
  ok(m && fs.existsSync(path.join(R, m[1].split('?')[0])), k + ' sheet defined and on disk');
  ok(m && +m[2] <= +m[5] * +m[6] && +m[3] * +m[5] <= 4096 && +m[4] * +m[6] <= 4096, k + ' grid holds n and fits 4096');
}
ok(er && po && er[3] === po[3] && er[4] === po[4], 'same frame box for both, so the cast hands off into the pool');
ok(er && +er[9] === 0.5, 'the column peaks at half the hero height (peakH 0.5)');
const fn = H.slice(H.indexOf('function updateWaxFx'), H.indexOf('function clearFx2'));
ok(/if\(!\(u\.alive&&\(u\._waxCoatT\|\|0\)>0\)\)\{ if\(u\._waxFx\)_killWaxFx\(u\); return; \}/.test(fn), 'shown only while the coat lasts - removed at coat end, shatter or death');
ok(/s\.spr\.material\.map=tp;[^\n]*s\.spr\.renderOrder=-4;/.test(fn), 'after the eruption the pool takes over, behind the unit like the other ground marks');
ok(/killAllStatusFx\(\); killAllWaxFx\(\); \}/.test(H), 'cleared with the other FX');
ok((H.match(/try\{ updateWaxFx\(dt\); \}catch\(e\)\{\}/g) || []).length === 2, 'ticked in battle and after the end');
// CONTROL: display only - it reads the coat and never writes it; the sealwax mechanic is unchanged
ok(!/_waxCoatT\s*[-+]?=[^=]|dealDamage|ccApply|\.hp\s*[-+]?=/.test(fn), 'CONTROL: the wax FX never writes the coat, damage or CC');
ok(/best\._sealT=o\.harden\|\|2\.0; best\._sealBy=u; best\._sealStun=o\.stun\|\|1\.1; best\._waxCoatT=o\.coat\|\|6; best\._waxCoatBy=u;/.test(H), 'CONTROL: Sealing Wax still slows, seals and coats the same way');

console.log('\nPASS: ' + pass + '  FAIL: ' + fail);
process.exit(fail ? 1 : 0);
