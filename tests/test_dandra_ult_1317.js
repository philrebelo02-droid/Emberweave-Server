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
// v1318 (Phil 9 Nov: "her ult isnt high enough" / "its not syncing with the other buffs placement"): the effect carries no placement of
// its own any more, so it takes the SAME above-the-bar badge placement as every other buff (_fxAboveBar path).
ck("Queen's Call effect has no own placement (no upAbove / upAnchor / upSize) - it uses the shared buff badge placement", !n.upAbove && !n.upAnchor && n.upSize == null, n);
ck("rally (Queen's Call) is an above-the-bar buff, like the other buffs", vm.runInContext('!!_ABOVE_BAR.rally', NEW.ctx));
ck('the effect sheet is unchanged (url, frames, grid, timing, disc)', ['u','n','fw','fh','cols','rows','dur'].every(k => n[k] === o[k]) && JSON.stringify(n.disc) === JSON.stringify(o.disc));
const heal = h => vm.runInContext("skLvNum('rally', ULT_DEF.rally, 1)", h.ctx);
ck("the heal is unchanged (Queen's Call is a team heal)", heal(NEW) === heal(OLD), [heal(NEW), heal(OLD)]);
ck('CONTROL: live v1316 had its own placement (upAbove, centred anchor, upSize 1.7), so it skipped the shared badge path', o.upAbove === true && o.upSize === 1.7);
console.log('test_dandra_ult_1317.js: ' + P + ' passed, ' + F + ' failed');
process.exit(F ? 1 : 0);
