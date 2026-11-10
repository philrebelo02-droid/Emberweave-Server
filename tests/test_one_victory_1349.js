// v1349 (Phil 10 Nov 2026: "When I clear a stage there shouldnt be 2 rewards screens, instead just put the stage star amount on this victory
// reward screen. Then when you click collect it sends you to campaign map."). CONTROL: live v1348 (git show 340103cf).
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
let P = 0, F = 0; const ck = (n, c) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n); } };
const html = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8');
const old = cp.execSync('git show 340103cf:emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }).toString();
const win = /if\(sWon && r && r\.reward\)\{ let _pop=null;[^\n]*\n[^\n]*/.exec(html); const w = win ? win[0] : '';
ck('the campaign win passes the stage stars (1-3) to the reward pop', /stars:Math\.max\(1,Math\.min\(3,r\.stars\|\|1\)\)/.test(w));
ck('Collect All runs the old CONTINUE route (campaign map, or the tutorial after 1-1..1-5)', /onGo:\(\)=>\{[^}]*resultBtn'\)\.click\(\)/.test(w));
ck('the old result page is hidden under the pop (one victory screen)', /classList\.add\('srUnder'\)/.test(w) && /#result\.srUnder>\*\{visibility:hidden\}/.test(html));
ck('the daily-limit warning moves onto the pop', /note:r\.reward\.dailyCapped\?ewT\('result\.daily_limit'\)/.test(w));
ck('the pop draws the stars (filled + empty to 3)', /opt\.stars\?`<div class="srStars">\$\{uiIcon\('star-filled'\)\.repeat\(opt\.stars\)\+uiIcon\('star-empty'\)/.test(html));
ck('a sweep still just closes its pop (no onGo)', /stageRewardPop\(stageRewardItems\(r\), t\('stage\.swept',\{n:r\.times\}\)\)/.test(html));
ck('CONTROL: v1348 showed two screens (pop with no stars over a visible result page)', !/srUnder/.test(old) && !/opt\.stars/.test(old));
console.log('test_one_victory_1349.js: ' + P + ' passed, ' + F + ' failed'); process.exit(F ? 1 : 0);
