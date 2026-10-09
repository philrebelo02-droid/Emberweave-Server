// v1073 - Oakmir's ult badge (Phil 8 Oct: "oakmir ult looks too large so its very saturated pixels"): the ult hangs a
// 320 px flower plate over every healed ally; the single-target badge path never passed the skill's badgeSize, so it
// was always the 0.8 default (~a hero's height of upscaled flowers). Rig: 3.79 -> 2.13 world units, looked at in battle.
const fs = require('fs'), path = require('path');
const H = fs.readFileSync(path.join(__dirname, '..', 'emberweave-heroes.html'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };

ok(/oakmir:\{deliver:'form',gfx:'oakmir_ult',gdur:5\.67,badgeSize:0\.45,noArea:true\}/.test(H), "Oakmir's ult: per-ally badges at 0.45 and NO area plate (v1096, Phil 9 Oct: 'the giant flower that still pops up' was the area plate at 30x scale)");
ok(/window\._fxAboveBar=!!\(\(_ABOVE_BAR\[type\]\|\|_DEBUFF_BADGE\[type\]\)&&c&&c\._sprRef\); window\._fxBadgeSize=o\.badgeSize\|\|null;/.test(H), 'the single-target badge path passes the skill\'s badgeSize');
ok(/window\._fxAboveBar=false; window\._fxBadgeSize=null;   \/\* v1073/.test(H), 'and clears it after, so it cannot leak into the next plate');
ok(/upSize:\(window\._fxBadgeSize\|\|0\.8\)/.test(H), 'a skill with no badgeSize still gets the 0.8 default');
// CONTROL: the badge size is display only - the ult def carries no heal/damage field change
ok(/try\{ if\(!o\.noArea\) _o=spawnGroundFx\(o\.gfx, c\.x, c\.y, R, _life\); \}/.test(H), 'abilArt skips the area plate when noArea');
const ult = (H.match(/oakmir:\{deliver:'form'[^}]*\}/) || [''])[0];
ok(!/heal|mul|hps|dur:/.test(ult.replace('gdur', '')), 'CONTROL: only art fields in the Oakmir ult art entry');

console.log('\nPASS: ' + pass + '  FAIL: ' + fail);
process.exit(fail ? 1 : 0);
