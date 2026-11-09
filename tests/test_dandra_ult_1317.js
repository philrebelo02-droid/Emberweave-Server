// v1317 (Phil 9 Nov 2026: "Can you make dandra ult be 20%, smaller"): Queen's Call's effect (FX2_DEF.dandra_ult) draws at upSize 1.36
// (was 1.7) - 20% smaller; everything else on the effect and the heal itself are unchanged. CONTROL: live v1316 (git show 14fde326).
const fs = require('fs'), path = require('path'), cp = require('child_process'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let P = 0, F = 0;
const ck = (n, c, x) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n + (x !== undefined ? ' - ' + JSON.stringify(x) : '')); } };
const load = f => require(path.join(ROOT, 'server', 'sim-host.js')).load(f);
const NEW = load(path.join(ROOT, 'emberweave-heroes.html'));
const oldFile = path.join(ROOT, '.test-1317-dandra.html');
fs.writeFileSync(oldFile, cp.execSync('git show 14fde326:emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }));
process.on('exit', () => { try { fs.unlinkSync(oldFile); } catch (e) {} });
const OLD = load(oldFile);
const fx = h => JSON.parse(vm.runInContext('JSON.stringify(FX2_DEF.dandra_ult)', h.ctx));
const n = fx(NEW), o = fx(OLD);
ck("Queen's Call effect: v1317 x0.8 then v1318 x0.7 (upSize = 0.56 x the v1316 1.7)", Math.abs(n.upSize - o.upSize * 0.8 * 0.7) < 1e-9, [n.upSize, o.upSize]);
const strip = x => { const c = Object.assign({}, x); delete c.upSize; return JSON.stringify(c); };
ck('every other field of the effect is unchanged (sheet, frames, anchor, disc, timing)', strip(n) === strip(o));
const heal = h => vm.runInContext("skLvNum('rally', ULT_DEF.rally, 1)", h.ctx);
ck("the heal is unchanged (Queen's Call is a team heal)", heal(NEW) === heal(OLD), [heal(NEW), heal(OLD)]);
ck('CONTROL: live v1316 drew it at upSize 1.7', o.upSize === 1.7, o.upSize);
console.log('test_dandra_ult_1317.js: ' + P + ' passed, ' + F + ' failed');
process.exit(F ? 1 : 0);
