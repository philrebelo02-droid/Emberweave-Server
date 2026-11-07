// v1300 (Phil 6 Nov: "starless well is siginificantly too hard, all heroes need like a 30% total stats cut"): every Starless Well enemy
// hero's health and damage multipliers are exactly 0.70x what they were (v1298 module), for every mode, square and level band.
// Control: WELL_OLD=1 compares v1298 to itself and must FAIL.
const path = require('path'), fs = require('fs'), os = require('os'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const NEW = require(path.join(ROOT, 'server/starless-well.js'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-wellold-'));
const oldSrc = cp.execSync('git show 0e123f3834e2ca953c3938cdfb9d20b02ace81cf:server/starless-well.js', { cwd: ROOT }).toString();
fs.writeFileSync(path.join(ROOT, 'server', '_well_old_1300.js'), oldSrc);
let OLD; try { OLD = require(path.join(ROOT, 'server', '_well_old_1300.js')); } finally { fs.unlinkSync(path.join(ROOT, 'server', '_well_old_1300.js')); }
const A = process.env.WELL_OLD ? OLD : NEW;
const table = JSON.parse(fs.readFileSync(path.join(ROOT, 'server/starless-well-heroes.json'), 'utf8'));
let n = 0, bad = [];
for (const mode of Object.keys(table.k)) for (let idx = 0; idx < table.ramp[mode].length; idx++) for (const lvl of table.anchors) {
  const a = A.fightWaves(mode, idx, lvl, ['korvux', 'vael', 'tick', 'sylthaine', 'fritz']), o = OLD.fightWaves(mode, idx, lvl, ['korvux', 'vael', 'tick', 'sylthaine', 'fritz']);
  if (!a || !o) continue;
  const hr = a[0][0].hpMul / o[0][0].hpMul, dr = a[0][0].dmgMul / o[0][0].dmgMul; n++;
  if (Math.abs(hr - 0.7) > 0.002 || Math.abs(dr - 0.7) > 0.002) bad.push(mode + '/' + idx + '/L' + lvl + ' hp x' + hr.toFixed(3) + ' dmg x' + dr.toFixed(3));
}
console.log((bad.length ? '  FAIL ' : '  ok   ') + n + ' Well fights (every mode, square, level band): enemy health and damage x0.70' + (bad.length ? ' - ' + bad.slice(0, 3).join('; ') : ''));
if (process.env.WELL_OLD) { console.log('CONTROL: ' + (bad.length ? 'failed as expected' : 'DID NOT FAIL')); process.exit(bad.length ? 0 : 1); }
process.exit(bad.length ? 1 : 0);
