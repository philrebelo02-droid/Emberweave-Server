// v1296 (Phil 6 Nov: "Include the past 2 patches worth" / "In the what's new"): a player's first What's New shows the latest update and the
// 2 before it; after that, every update since the one they last saw (up to 5). Control: AUD_HTML=<the v1295 html> must FAIL.
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(process.env.AUD_HTML || path.join(__dirname, '..', 'emberweave-heroes.html'), 'utf8');
const m = src.match(/let fresh = \((.*?)\)\.slice\(0,5\);/);
const pick = m ? new Function('notes', 'seen', 'at', 'return (' + m[1] + ').slice(0,5);') : null;
const notes = ['1.4.5', '1.4.4', '1.4.3', '1.4.2', '1.4.1', '1.4.0', '1.3.9'].map(ver => ({ ver }));
const vers = (seen) => pick ? pick(notes, seen, seen ? notes.findIndex(p => p.ver === seen) : -1).map(p => p.ver).join(',') : 'none';
const checks = [
  ['first popup (never seen one): the latest update and the 2 before it (' + vers(undefined) + ')', vers(undefined) === '1.4.5,1.4.4,1.4.3'],
  ['saw 1.4.3 last: shows 1.4.5 and 1.4.4 (' + vers('1.4.3') + ')', vers('1.4.3') === '1.4.5,1.4.4'],
  ['saw an old patch no longer listed: the latest 3 (' + vers('0.9') + ')', vers('0.9') === '1.4.5,1.4.4,1.4.3']];
checks.forEach(c => console.log((c[1] ? '  ok   ' : '  FAIL ') + c[0]));
const bad = checks.filter(c => !c[1]);
if (process.env.AUD_HTML) { console.log('CONTROL: ' + bad.length + ' check(s) failed as expected'); process.exit(bad.length ? 0 : 1); }
if (bad.length) process.exit(1);
console.log('test_whats_new_three_1296.js: ' + checks.length + ' checks passed');
