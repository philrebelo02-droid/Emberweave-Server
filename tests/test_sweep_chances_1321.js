// v1321 (Phil 9 Nov 2026): "elite staged that have 3 chances. Allow x3 sweep for it instead of having the x10 sweep there" / "when I sweep
// it doesnt remove from the sweep chance display until I exit the stage and come back, also preventing me from resetting chances is
// unavailable until I exit stage". CONTROL: v1320 (git show 68b0d29b).
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
let P = 0, F = 0;
const ck = (n, c, x) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n + (x !== undefined ? ' - ' + JSON.stringify(x) : '')); } };
const html = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8');
const old = cp.execSync('git show 68b0d29b:emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }).toString();

ck('Guardian / boss / elite / veteran stages get a Sweep xN button (N = runs left today, capped by stamina)', /id="smSweepN" data-n="\$\{n\}"/.test(html) && /const n=Math\.max\(0,Math\.min\(_left,Math\.floor\(\(G\.stamina\|\|0\)\/Math\.max\(1,stageStamCost\(i,mode\)\)\)\)\)/.test(html));
ck('its label is Sweep xN (x3 when out of runs, disabled)', /t\('stage\.sweep'\)\+' ×'\+\(n>0\?n:ELITE_BOSS_DAILY\)/.test(html));
ck('it sweeps exactly N runs', /swN\.onclick=\(\)=>\{ const n=\+swN\.dataset\.n\|\|0; if\(n>0\) sweepStage\(i,n,mode\); \}/.test(html));
ck('normal stages keep Sweep x10', /cleared&&!_eb\?`<button class="btn secondary" id="smSweep10"/.test(html));
ck('CONTROL: v1320 showed a disabled x10 on these stages and had no xN', !/smSweepN/.test(old));
ck('after a sweep the stage panel is drawn again from the new counts (chances n/3, buttons, EGP reset) before the receipt', /openStageModal\(i,mode\); \}catch\(e\)\{\}\r?\n\s*const tgt=document\.getElementById\('smFragTarget'\);/.test(html));
ck('the receipt survives the panel\'s own stage refresh', /window\._smReceipt=\{key:mode\+':'\+i, html:tgt\.innerHTML\}/.test(html) && /\(window\._smReceipt&&window\._smReceipt\.key===_smKey\)\?window\._smReceipt\.html:stageDropsHTML/.test(html));
ck('closing the panel forgets the receipt (a fresh open shows the drops)', /function closeStageModal\(\)\{ window\.SM_KEY=null; window\._smReceipt=null;/.test(html));
ck('CONTROL: v1320 never redrew the panel after a sweep', !/_smReceipt/.test(old));
console.log('test_sweep_chances_1321.js: ' + P + ' passed, ' + F + ' failed');
process.exit(F ? 1 : 0);
