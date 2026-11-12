// v1366 (Phil 11 Nov 2026, tester: "floor 50 was too easy a tester is saying, increase stats 8%" / "in vault").
// Vault floor 50: every enemy hp and damage x1.08; every other floor untouched. CONTROL: v1365's table.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
let P = 0, F = 0; const ck = (n, c, x) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n + (x ? ' - ' + x : '')); } };
const now = JSON.parse(fs.readFileSync(path.join(ROOT, 'server/vault-encounters.json'), 'utf8')).floors;
const old = JSON.parse(cp.execSync('git show 7e49f874:server/vault-encounters.json', { cwd: ROOT, maxBuffer: 64 << 20 }).toString()).floors;
const near = (a, b) => Math.abs(a - b) <= 0.0001;
const f50 = now[49], o50 = old[49];
ck('floor 50 is the floor-50 record', f50.floor === 50 && o50.floor === 50);
let all = true, cnt = 0;
f50.waves.forEach((w, i) => w.forEach((s, j) => { const o = o50.waves[i][j]; cnt++;
  if (!(s.key === o.key && near(s.hpMul, +(o.hpMul * 1.08).toFixed(4)) && near(s.dmgMul, +(o.dmgMul * 1.08).toFixed(4)))) all = false; }));
ck('every floor-50 enemy (' + cnt + ', boss included) has hp and damage x1.08', all && cnt === 9);
ck('CONTROL: v1365 floor 50 had the old numbers (3.1827 / 3.8072 first enemy)', o50.waves[0][0].hpMul === 3.1827 && o50.waves[0][0].dmgMul === 3.8072);
ck('every other floor is untouched (floors 60-100 were re-tuned in v1372 - pinned by test_vault_curve_1372.js)', now.every((f, i) => i === 49 || i >= 59 || JSON.stringify(f) === JSON.stringify(old[i])));
ck('floor 50 rewards and boss rule untouched', f50.dust === o50.dust && JSON.stringify(f50.bossRule) === JSON.stringify(o50.bossRule) && JSON.stringify(f50.gearFragments) === JSON.stringify(o50.gearFragments));
console.log('test_vault50_1366.js: ' + P + ' passed, ' + F + ' failed'); process.exit(F ? 1 : 0);
