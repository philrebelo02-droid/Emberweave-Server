// v1069 - Sloe's Emerald Volley fires Grok's single arrow sprite, one per target, staggered (Phil-approved 8 Oct).
// Static checks on the wiring; the in-game look was checked on the rig (6 launches 2.05-2.62 s, 6 hits of equal damage).
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
const H = fs.readFileSync(path.join(R, 'emberweave-heroes.html'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };

const def = H.match(/\n\s*sloearrow:\{u:'([^']+)',n:1,fw:(\d+),fh:(\d+),cols:1,rows:1,dur:1\}/);
ok(def, 'FX2_DEF has the one-frame sloearrow plate');
const file = def && def[1].split('?')[0];
ok(file && fs.existsSync(path.join(R, file)), 'the arrow asset exists on disk (' + file + ')');
ok(def && /\?v=\d+$/.test(def[1]), 'the arrow asset carries a ?v= version');
ok(/sloe:\{backline:true,pfx:'sloearrow',pscale:[\d.]+,pdur:[\d.]+,stagger:[\d.]+\}/.test(H), "Sloe's ult plate uses the arrow, keeps backline and staggers");
ok(/const _dl=_r\*0\.15\+\(o\.stagger&&!_one\?_list\.indexOf\(e\)\*o\.stagger:0\);/.test(H), 'case volley delays each target by its index x stagger');
ok(/if\(_dl<=0\) _fire\(\); else groundHazards\.push\(\{arrival:true,delay:_dl,run:_fire\}\);/.test(H), 'the first arrow fires at once, the rest through the hazard clock (replay-safe)');
ok(/if\(o&&o\.stagger\) break;/.test(H), 'no rain-down cast visual for Sloe (no fan clip, no impact burst)');
// control: other volley users (Shard Volley) carry no stagger, so they still fire together
ok(/'volthex':\s*\{green:\{name:'Shard Volley',type:'volley',[^}]*\}/.test(H) && !/'volthex':\s*\{green:\{[^}]*stagger/.test(H), 'CONTROL: Shard Volley has no stagger (unchanged)');

console.log('\nPASS: ' + pass + '  FAIL: ' + fail);
process.exit(fail ? 1 : 0);
