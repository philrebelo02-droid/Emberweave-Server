// v1359 (ChatGPT audit round 5 part 1, verified by Claude): reward answers and transactions report what was ACTUALLY credited after the
// caps (quests, quest chain, sign-in, star milestones, Arena daily, campaign clear + sweep), and three shops refuse BEFORE the charge when the
// cap would cut the grant (Market fragments, Arena shop gold / diamonds). Each fixture runs the real handler text cut from server.js.
// CONTROL: every fixture must FAIL on v1358's server.js (git show 47540784).
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const ROOT = path.join(__dirname, '..'), FX = path.join(__dirname, 'fixtures_1359');
let P = 0, F = 0; const ck = (n, c, x) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n + (x ? ' - ' + x : '')); } };
const ctl = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'ac1359-')), 'server_1358.js');
fs.writeFileSync(ctl, cp.execSync('git show 47540784:server.js', { cwd: ROOT, maxBuffer: 64 << 20 }));
const run = (f, target) => cp.spawnSync(process.execPath, [path.join(FX, f), target], { encoding: 'utf8' });
const list = fs.readdirSync(FX).filter(f => f.endsWith('.test.cjs')).sort();
ck('nine fixtures present', list.length === 9, String(list.length));
for (const f of list) { const a = run(f, path.join(ROOT, 'server.js')), b = run(f, ctl);
  ck(f.replace('.test.cjs', '') + ': passes on this server.js', a.status === 0, (a.stderr || '').split('\n').slice(0, 3).join(' '));
  ck(f.replace('.test.cjs', '') + ': CONTROL fails on v1358', b.status !== 0); }
console.log('test_actual_credit_1359.js: ' + P + ' passed, ' + F + ' failed'); process.exit(F ? 1 : 0);
