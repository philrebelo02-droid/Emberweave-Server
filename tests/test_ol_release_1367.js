// v1368 memory audit (Phil 11 Nov 2026: "Check to make sure no mode slips through"): a live PvP match clears OL.active only in onlineResult /
// onPeerLeft. A match left any other way (quit mid-match, a drop with no peer-left message) kept it on, so evictBattleArtAll skipped for the
// rest of the session. Leaving battle/result now ends it too (a safety net; the normal end was already fine).
const fs = require('fs'), path = require('path'), cp = require('child_process'); const ROOT = path.join(__dirname, '..');
let P = 0, F = 0; const ck = (n, c) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n); } };
const body = (s) => { const i = s.indexOf('function _showScreen('); return s.slice(i, s.indexOf('\nfunction ', i + 20)); };
const src = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8'), b = body(src);
ck('show() ends a live PvP match when it leaves battle/result', b.indexOf("if(name!=='battle'&&name!=='result'&&typeof OL!=='undefined'&&OL.active){ OL.active=false;") > 0);
ck('it runs before the screen-change memory release', b.indexOf('OL.active=false') < b.indexOf("if(name==='home') setTimeout(()=>{ try{ evictBattleArtAll()"));
const old = cp.execSync('git show 7e49f874:emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }).toString();
ck('CONTROL: v1365 cleared it only at a normal match end, never on leaving the screen', old.indexOf("OL.active=false;show('result')") > 0 && body(old).indexOf('OL.active=false') < 0);
console.log('test_ol_release_1367.js: ' + P + ' passed, ' + F + ' failed'); process.exit(F ? 1 : 0);
