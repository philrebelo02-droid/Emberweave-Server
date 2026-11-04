// 22 Oct 2026 (Ember's Skyfall sweep, Phil: "Yes go"; ChatGPT's Market run-ahead pass):
//  1) Skyfall: your line showed "(N orders)" from a 5-per-member march allowance that v678's per-line kill cap replaced - it
//     counted down and went negative. It now shows the line's kills out of the cap, from the server's own kills/killsLeft.
//  2) Market: the Peace Shield showed its restock-time price and was charged the current-level price (95 shown, 98 charged).
// Usage: node test_skyfall_kills_shield_22oct.js [repo root]
const fs = require('fs'), path = require('path');
const root = process.argv[2] || path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'emberweave-heroes.html'), 'utf8');
const srv = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
let fail = 0, n = 0;
const check = (ok, what) => { n++; if (!ok) { fail++; console.log('FAIL: ' + what); } };

// 1) Skyfall label: run the client's own label expression on the server's view fields, at every kill count
check(!/\('\+d\.assaultsLeft\+' orders\)/.test(html), 'the board still shows the dead "(N orders)" countdown');
// v1265 languages: the label is t('skyfall.kills',{n,m}) with the English "{n}/{m} kills" in lang/en.json - run it with that English
const EN = JSON.parse(fs.readFileSync(path.join(root, 'lang', 'en.json'), 'utf8'));
const tEn = (k, v) => { const s = EN[k]; if (s == null) throw new Error('missing English for ' + k); return s.replace(/\{(\w+)\}/g, (m, x) => v && v[x] != null ? String(v[x]) : ''); };
check(EN['skyfall.kills'] === '{n}/{m} kills', 'the English Skyfall kills label changed in lang/en.json');
const lab = (html.match(/' <span style="color:#ffd45e">\('(\+t\('skyfall\.kills',\{n:d\.kills\|0,m:\(d\.kills\|0\)\+\(d\.killsLeft\|0\)\}\)\+)'\)<\/span>'/) || [])[1];
check(!!lab, 'the board does not show kills out of the cap');
const cap = +(srv.match(/const WAR_KILL_CAP=(\d+)/) || [])[1];
check(cap === 5, 'WAR_KILL_CAP not found (want 5)');
check(/killsLeft:Math\.max\(0,WAR_KILL_CAP-\(d\.kills\|0\)\)/.test(srv) && /kills:d\.kills\|0/.test(srv), 'the server view no longer sends kills / killsLeft');
if (lab && cap) for (let k = 0; k <= cap; k++) {
  const d = { kills: k, killsLeft: Math.max(0, cap - k) };
  const shown = Function('d', 't', "return ''" + lab + "''")(d, tEn);
  if (shown !== k + '/' + cap + ' kills') { check(false, 'line with ' + k + ' kills shows "' + shown + '", want "' + k + '/' + cap + ' kills"'); break; }
}

// 2) Peace Shield: the shown price equals the server's charge at the CURRENT level, for every level 1-120
const fix = /if\(ACC\.token\) for\(const o of \(G\.market\.offers\|\|\[\]\)\) if\(o\.kind==='shield'\) o\.cost=\{gems:(Math\.round\(70\*\(1\+\(playerLevel\(\)-1\)\*0\.04\)\))\};/;
const shown = (html.match(fix) || [])[1];
check(!!shown, 'renderMarket does not set the shield price from the current level');
const charge = (srv.match(/if\(what==='shield_market'\)\{ const L=ledPlayerLevel\(led\), c=(Math\.round\(70\*\(1\+\(L-1\)\*0\.04\)\));/) || [])[1];
check(!!charge, 'server shield_market price formula not found');
if (shown && charge) for (let L = 1; L <= 120; L++) {
  const a = Function('playerLevel', 'return ' + shown)(() => L), b = Function('L', 'return ' + charge)(L);
  if (a !== b) { check(false, 'level ' + L + ': shows ' + a + ', server charges ' + b); break; }
}
console.log(fail ? 'FAIL ' + fail + ' of ' + n : 'PASS ' + n + ' checks (Skyfall kills label, Peace Shield price = server charge)');
process.exit(fail ? 1 : 0);
