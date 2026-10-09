// v1075 - Dead Man's Fortune (Rafe ult, Grok spell 19, Phil-approved 8 Oct): Grok's hot ball + orange tracer flies at each
// enemy the ult hits (the existing pfx flight, 0.30 s) and the clip's spark star bursts on its chest as the damage lands.
// Rig: 5 tracers fan out, 5 sparks at chest height in front of the bodies, gone by ~1.3 s.
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
const H = fs.readFileSync(path.join(R, 'emberweave-heroes.html'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };

const tr = H.match(/\n\s*rafetracer:\{u:'([^']+)',n:1,/), sp = H.match(/\n\s*rafespark:\{u:'([^']+)',n:(\d+),fw:(\d+),fh:(\d+),cols:(\d+),rows:(\d+),dur:([\d.]+),upright:true/);
ok(tr && fs.existsSync(path.join(R, tr[1].split('?')[0])), 'the tracer sheet is defined and on disk');
ok(sp && fs.existsSync(path.join(R, sp[1].split('?')[0])), 'the spark sheet is defined and on disk');
ok(sp && +sp[2] <= +sp[5] * +sp[6] && +sp[3] * +sp[5] <= 4096 && +sp[4] * +sp[6] <= 4096, 'spark grid holds n and fits 4096');
ok(/rafe:\{evadeEva:0\.5,evadeDur:3,pfx:'rafetracer',pscale:0\.9,pdur:0\.30,spark:'rafespark'\}/.test(H), "Rafe's ult flies the tracer at the old 0.30 s and names the spark (evade buff unchanged)");
ok(/abilShot\(u,o,e,'#5ee89b',o\.spark\?\(\)=>shotSpark\(o\.spark,e\):undefined\);/.test(H), 'each shot fires the spark on arrival at its own target');
const fn = H.slice(H.indexOf('function shotSpark'), H.indexOf('function abilShot'));
ok(/applyQuaternion\(camera\.quaternion\)\.multiplyScalar\(\(e\.sprH\|\|3\.9\)\*0\.62\)/.test(fn), 'the spark sits at chest height along camera up (billboard height)');
ok(/fo\.m\.renderOrder=2;/.test(fn), 'drawn in front of the body it hits');
ok(/if\(o&&o\.spark\) break;/.test(H), 'no green rain-down on the targets (Grok: no other art)');
// CONTROL: display only - damage timing and amount come from the same lines as before
ok(/const _pd=o\.pdur\|\|0\.30, _MD=dB\*\(o\.mul\|\|1\.6\)\*rm;/.test(H) && /groundHazards\.push\(\{arrival:true,delay:_pd,run:function\(\)\{ if\(e\.alive\) dealDamage\(u,e,_MD,'#5ee89b'\); \}\}\);/.test(H), 'CONTROL: each shot still deals its damage at 0.30 s, same amount');
ok(!/dealDamage|\.hp\s*[-+]?=|groundHazards/.test(fn), 'CONTROL: the spark touches no hp, damage or hazards');

console.log('\nPASS: ' + pass + '  FAIL: ' + fail);
process.exit(fail ? 1 : 0);
