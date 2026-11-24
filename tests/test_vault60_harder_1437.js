// v1437 (Phil 24 Nov 2026, a player: "You need to increase the difficulty of floors 60 and above in The Vault" / "Perhaps 10% more damage
// and more health" / "From level 60 onwards"): server/vault-encounters.json floors 60-100 - every monster's hpMul and dmgMul x1.10 and the
// floor's recommendedPower x1.10 (rounded as written); floors 1-59 and every other field byte-identical to v1436 (09c1c3180).
// The no-one-shot rule for ready teams (v1378) still holds - tests/test_vault_no_oneshot_1377.js runs the real fights.
// CONTROL: v1436's floor 60 first enemy is 2.4841 / 3.3504.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..'), BASE = '09c1c3180';
let P = 0, F = 0; const ck = (n, c) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n); } };
const NOW = JSON.parse(fs.readFileSync(path.join(ROOT, 'server/vault-encounters.json'), 'utf8')).floors;
const OLD = JSON.parse(cp.execSync('git show ' + BASE + ':server/vault-encounters.json', { cwd: ROOT, maxBuffer: 64 << 20 }).toString()).floors;
const x = v => +(v * 1.1).toFixed(4);
ck('CONTROL: v1436 floor 60 first enemy was 2.4841 / 3.3504', OLD[59].waves[0][0].hpMul === 2.4841 && OLD[59].waves[0][0].dmgMul === 3.3504);
ck('100 floors', NOW.length === 100 && OLD.length === 100);
ck('floors 1-59 identical to v1436', NOW.slice(0, 59).every((f, i) => JSON.stringify(f) === JSON.stringify(OLD[i])));
let units = 0, exact = true, same = true;
for (let i = 59; i < 100; i++) { const n = NOW[i], o = OLD[i];
  if (n.recommendedPower !== Math.round(o.recommendedPower * 1.1)) exact = false;
  n.waves.forEach((w, a) => w.forEach((m, b) => { const q = o.waves[a][b]; units++;
    if (m.hpMul !== x(q.hpMul) || m.dmgMul !== x(q.dmgMul)) exact = false;
    if (JSON.stringify(Object.assign({}, m, { hpMul: 0, dmgMul: 0 })) !== JSON.stringify(Object.assign({}, q, { hpMul: 0, dmgMul: 0 }))) same = false; }));
  if (JSON.stringify(Object.assign({}, n, { waves: 0, recommendedPower: 0 })) !== JSON.stringify(Object.assign({}, o, { waves: 0, recommendedPower: 0 }))) same = false; }
ck('floors 60-100: all ' + units + ' monsters have hpMul and dmgMul x1.10, recommendedPower x1.10', exact && units > 300);
ck('floors 60-100: nothing else changed (keys, levels, bosses, rules, rewards)', same);
ck('floor 60 first enemy is now 2.7325 / 3.6854', NOW[59].waves[0][0].hpMul === 2.7325 && NOW[59].waves[0][0].dmgMul === 3.6854);
console.log('test_vault60_harder_1437.js: ' + P + ' passed, ' + F + ' failed'); process.exit(F ? 1 : 0);
