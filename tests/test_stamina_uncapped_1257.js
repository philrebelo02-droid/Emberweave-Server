// v1257 (Phil 2 Nov 2026: "Also there shouldnt be a max to stamina"): no 999 ceiling on held stamina. Static checks on server.js.
// Exit 0 = passed. Control: ST_SRV=<the v1256 server.js> FAILS.
const fs = require('fs'), path = require('path'), assert = require('assert');
const s = fs.readFileSync(process.env.ST_SRV || path.join(__dirname, '..', 'server.js'), 'utf8');
let n = 0; const ok = (c, m) => { assert(c, m); n++; console.log('  ok   ' + m); };
ok(/const STAM_CEIL=1e9;/.test(s), 'the stamina guard is 1e9 (overflow only)');
ok(!/Math\.min\(999, ?(led\.stam\.v|before)/.test(s), 'no stamina add is clamped at 999 any more');
ok(!/led\.stam\.v>=999/.test(s), 'meals and Ember Roasts are no longer refused at 999');
ok(!/Your stamina is full \(999\)/.test(s), 'Emberdraft no longer reports a 999 cut');
ok((s.match(/STAM_CEIL/g) || []).length >= 12, 'every stamina credit path uses STAM_CEIL (' + (s.match(/STAM_CEIL/g) || []).length + ')');
console.log('test_stamina_uncapped_1257.js: ' + n + ' checks passed');
