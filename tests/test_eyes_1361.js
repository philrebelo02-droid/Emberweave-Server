// v1361: Grok's EYES findings, each measured in the live page on a level-60 account before fixing (Open Projects/NIGHT AUDIT 11NOV2026). Static guards, v1360 control.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..'); let P = 0, F = 0; const ck = (n, c) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n); } };
const H = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8').replace(/\r\n/g, '\n'), H0 = cp.execSync('git show 2f010c7f:emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }).toString().replace(/\r\n/g, '\n');
const both = (name, re) => { ck(name, re.test(H)); ck('CONTROL v1360: ' + name, !re.test(H0)); };
both('Campaign map: a turned (upright) device counts as landscape (bonus plates were off the frame)', /const _land=!!\(window\.EWViewport&&EWViewport\.state&&EWViewport\.state\.rotated\)\|\|window\.matchMedia\('\(orientation:landscape\)'\)\.matches;\n  const _wideCampaign=_land && !!_app/);
both('show(): the scroll reset runs after the screen is shown', /target\.classList\.add\('active'\); target\.scrollTop=0; \}/);
both('the letterbox bar sizes are published for window-fixed controls', /de\.style\.setProperty\('--ew-bar-x',Math\.max\(0,Math\.round\(\(vw-Math\.floor\(w\)\)\/2\)\)\+'px'\); de\.style\.setProperty\('--ew-bar-y'/);
both('campaign orb sits inside the game frame', /#campBonusBtn\{position:fixed!important;top:auto!important;right:auto!important;left:calc\(10px \+ var\(--ew-bar-x,0px\)/);
both('town chat bar sits inside the game frame', /#chatWidget\.min\{left:calc\(max\(3px,env\(safe-area-inset-left,0px\)\) \+ var\(--ew-bar-x,0px\)\);bottom:calc\(max\(2px,env\(safe-area-inset-bottom,0px\)\) \+ var\(--ew-bar-y,0px\)\)\}/);
both('Wishing Pool: both button rows on a Fold cover; a 390 px phone keeps its layout', /@media\(max-height:370px\) and \(min-width:701px\)\{#wishing #wpsStage\{padding:4px 3% 6px!important/);
console.log('test_eyes_1361.js: ' + P + ' passed, ' + F + ' failed'); process.exit(F ? 1 : 0);
