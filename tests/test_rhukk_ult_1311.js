// v1311 (Phil 8 Nov 2026): "Rhukk ult it way too strong, reduce to 200% attack damage scale and 300% at 100".
// Impale Rush was ULT_DEF.charge mul 1.8 x skillMul = 394% of Attack at skill level 100. Now Rhukk's own ratio: 200% at level 1,
// +1.0 spread evenly to 300% at 100 - in the fight AND on every display. Tharl / Askel / Brannus (the other charge heroes) unchanged.
// CONTROL: the live v1310 page (git show 67ecbab6) shows Rhukk at 394% at level 100.
const fs = require('fs'), path = require('path'), cp = require('child_process'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let PASS = 0, FAIL = 0;
const ck = (n, c, x) => { if (c) { PASS++; console.log('  ok   ' + n); } else { FAIL++; console.log('  FAIL ' + n + (x !== undefined ? ' - ' + x : '')); } };
const load = f => require(path.join(ROOT, 'server', 'sim-host.js')).load(f);
const NEW = load(path.join(ROOT, 'emberweave-heroes.html'));
const oldFile = path.join(ROOT, '.test-1311-live.html');
fs.writeFileSync(oldFile, cp.execSync('git show 67ecbab6:emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }));
process.on('exit', () => { try { fs.unlinkSync(oldFile); } catch (e) {} });
const OLD = load(oldFile);
const R = (h, c) => vm.runInContext(c, h.ctx);
const meta = (h, k, L) => { R(h, 'var __sl=' + L + '; skillLevel=function(){return __sl;}'); return R(h, "abilityMeta('" + k + "',0)"); };
const pct = s => +((String(s).match(/(\d+)% of Attack/) || [])[1]);
console.log('== Rhukk Impale Rush ratio ==');
ck('level 1 shows 200% of Attack', pct(meta(NEW, 'rhukk', 1)) === 200, meta(NEW, 'rhukk', 1));
ck('level 50 shows 249% of Attack (200 + 49/99)', pct(meta(NEW, 'rhukk', 50)) === 249, meta(NEW, 'rhukk', 50));
ck('level 100 shows 300% of Attack', pct(meta(NEW, 'rhukk', 100)) === 300, meta(NEW, 'rhukk', 100));
ck('the fight ratio = the shown ratio: heroUltMul(rhukk, 1 / 100) = 2.0 / 3.0', Math.abs(R(NEW, 'heroUltMul("rhukk",1)') - 2) < 1e-9 && Math.abs(R(NEW, 'heroUltMul("rhukk",100)') - 3) < 1e-9);
ck('the slam divides out the skill curve (dB carries sm once): the charge line uses heroUltMul(u.key,u._castLv)/(sm||1)',
  /_cD=dB\*\(\(heroUltMul\(u\.key,u\._castLv\)!=null\)\?heroUltMul\(u\.key,u\._castLv\)\/\(sm\|\|1\):\(o\.mul\|\|1\.6\)\)\*rm/.test(fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8')));
ck('the AoE value line follows the same ratio (3x Attack at level 100)', (() => { R(NEW, '__sl=100'); const s = R(NEW, "_skillEffectStrRaw('rhukk',0,1000,5000)"); return /\b3000\b/.test(s); })(), R(NEW, "_skillEffectStrRaw('rhukk',0,1000,5000)"));
console.log('== the other charge heroes keep the shared ratio ==');
for (const k of ['tharl', 'askel', 'brannus']) ck(k + ' at level 100 unchanged vs live', meta(NEW, k, 100) === meta(OLD, k, 100), meta(NEW, k, 100));
ck('CONTROL: live v1310 shows Rhukk at 394% at level 100', pct(meta(OLD, 'rhukk', 100)) === 394, meta(OLD, 'rhukk', 100));
console.log('test_rhukk_ult_1311.js: ' + PASS + ' passed, ' + FAIL + ' failed');
process.exit(FAIL ? 1 : 0);
