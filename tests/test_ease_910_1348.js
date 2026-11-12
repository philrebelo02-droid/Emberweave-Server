// v1348 (Phil 10 Nov: "ease 9-10 so level 57 wins 75%"): Normal and Veteran 9-10 enemy hpMul and dmgMul x0.894 vs v1347 (05196de9);
// nothing else in either table moved. Measured in the real engine (calib_910.js, 80 fights, level-57 spec teams): 76.25%, was 55%.
const fs = require('fs'), path = require('path'), cp = require('child_process'), assert = require('assert');
const ROOT = path.join(__dirname, '..');
const V1372 = { '1-7': [0.117, 0.8], '1-8': [0.188, 0.8], '1-9': [0.225, 0.8], '1-10': [0.386, 0.9] };   // v1372 chapter-1 spike nerf on top (tests/test_stage_curve_1372.js)
function problems(f, cur) { const old = JSON.parse(cp.execSync('git show 05196de9:server/' + f, { cwd: ROOT, maxBuffer: 64 << 20 }).toString()), om = Object.fromEntries(old.map(s => [s.id, s])), out = [];
  for (const s of cur) { const o = om[s.id], k = s.id === '9-10' ? 0.894 : 1, v = V1372[s.id] || [1, 1];
    s.waves.forEach((w, wi) => w.forEach((m, mi) => { const q = o.waves[wi][mi];
      if (Math.abs(m.hpMul - q.hpMul * k * v[0]) > 1e-3 * Math.max(1, q.hpMul) || Math.abs(m.dmgMul - q.dmgMul * k * v[1]) > 1e-3 * Math.max(1, q.dmgMul)) out.push(s.id); })); }
  return [...new Set(out)]; }
for (const f of ['campaign-encounters.json', 'veteran-campaign-encounters.json', 'elite-campaign-encounters.json']) {
  const cur = JSON.parse(fs.readFileSync(path.join(ROOT, 'server', f), 'utf8'));
  assert.deepStrictEqual(problems(f, cur), [], f + ' ' + problems(f, cur).join(','));
  // CONTROL: the un-eased table is caught
  const raw = JSON.parse(cp.execSync('git show 05196de9:server/' + f, { cwd: ROOT, maxBuffer: 64 << 20 }).toString());
  assert.deepStrictEqual(problems(f, raw), ['1-7', '1-8', '1-9', '1-10', '9-10'], 'CONTROL failed for ' + f); }
console.log('PASS ease 9-10 1348');
