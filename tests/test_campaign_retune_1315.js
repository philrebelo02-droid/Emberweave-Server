// v1315 (Phil 8 Nov 2026): "this is too easy, check all chapters" / "my level 100 team ... easily do 16-10 without taking any damage" /
// "you can make those chages but increase the stat % to balance". Ruler: Phil's own team (Aureth, Mirelle, Askel, Rivet, Sloe) at each stage's
// expected level - chapter bosses 85% for 1-9, ramp 85% -> 40% for 10-16. Chapters 7-16 enemy HP and damage x factor below; chapters 1-6 unchanged
// (a maxed 5-star team wins them even at x3 - tuning them to it would wall new players). Recommended power is the target-level team's power: unchanged.
// CONTROL: v1314 (git show 37ec5870).
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
let P = 0, F = 0;
const ck = (n, c, x) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n + (x !== undefined ? ' - ' + JSON.stringify(x) : '')); } };
const K = { 7: 1.49, 8: 1.28, 9: 1.13, 10: 1.38, 11: 1.24, 12: 1.53, 13: 1.07, 14: 1.35, 15: 1.13, 16: 1.03 };
const cur = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'server', f), 'utf8'));
const old = f => JSON.parse(cp.execSync('git show 37ec5870:server/' + f, { cwd: ROOT, maxBuffer: 64 << 20 }).toString());
for (const f of ['campaign-encounters.json', 'elite-campaign-encounters.json']) {
  const N = cur(f), O = old(f), om = Object.fromEntries(O.map(s => [s.id, s]));
  const bad = [], same = [], rp = [];
  for (const s of N) { const o = om[s.id], ch = +s.id.split('-')[0], k = (K[ch] || 1) * (s.id === '9-10' ? 0.894 : 1);   // v1348 (Phil 10 Nov: "ease 9-10 so level 57 wins 75%"): Normal 9-10 x0.894 on top (tests/test_ease_910_1348.js)
    s.waves.forEach((w, wi) => w.forEach((m, mi) => { const q = o.waves[wi][mi];
      if (Math.abs(m.hpMul - q.hpMul * k) > 2e-3 * Math.max(1, q.hpMul) || Math.abs(m.dmgMul - q.dmgMul * k) > 2e-3 * Math.max(1, q.dmgMul)) (K[ch] ? bad : same).push(s.id); }));
    if (s.recommendedPower !== o.recommendedPower) rp.push(s.id); }
  ck(f + ': chapters 7-16 enemy HP and damage x their chapter factor', bad.length === 0, [...new Set(bad)].slice(0, 6));
  ck(f + ': chapters 1-6 unchanged', same.length === 0, [...new Set(same)].slice(0, 6));
  ck(f + ': recommended power unchanged (it is the target-level team, not the enemy)', rp.length === 0, rp.slice(0, 6));
}
const N = cur('campaign-encounters.json'), V = cur('veteran-campaign-encounters.json'), nm = Object.fromEntries(N.map(s => [s.id, s]));
ck('Veteran stays exactly Normal x2', V.every(v => v.waves.every((w, wi) => w.every((m, mi) => Math.abs(m.hpMul - nm[v.id].waves[wi][mi].hpMul * 2) < 2e-3 * Math.max(1, m.hpMul)))));
const O = old('campaign-encounters.json'), s16 = N.find(s => s.id === '12-10'), o16 = O.find(s => s.id === '12-10');
ck('CONTROL: v1314 12-10 was 1.53x weaker than now', Math.abs(s16.waves[0][0].hpMul / o16.waves[0][0].hpMul - 1.53) < 0.01, s16.waves[0][0].hpMul / o16.waves[0][0].hpMul);
console.log('test_campaign_retune_1315.js: ' + P + ' passed, ' + F + ' failed');
process.exit(F ? 1 : 0);
