// v1361 (ChatGPT audit round 5 parts 1-2 + Claude's ledger-diff currency audit, 11 Nov): seventeen more cap-edge fixes. Reward answers and
// transactions carry the amount ACTUALLY credited (tutorial, province, tower, trial, Arena win gold, guild raid, pools, Starless Well, campaign
// potions, fragments above the cap), and purchases that could not be held are refused BEFORE the charge (gold buy, War Chest, Guild Shop gold /
// diamonds, plan claim, diamond packs). Each fixture runs the real handler text cut from its file. CONTROL: each fails on v1360 (git show 2f010c7f).
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const ROOT = path.join(__dirname, '..'), FX = path.join(__dirname, 'fixtures_1361');
let P = 0, F = 0; const ck = (n, c, x) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n + (x ? ' - ' + x : '')); } };
const TARGETS = ['server.js', 'server/starless-well.js', 'emberweave-heroes.html', '.'];   // '.' = a fixture that takes the tree root
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ac1361-')); const ctl = {};
fs.mkdirSync(path.join(tmp, 'server'));
for (const t of TARGETS) { if (t === '.') { ctl[t] = tmp; continue; } ctl[t] = path.join(tmp, t); fs.writeFileSync(ctl[t], cp.execSync('git show 2f010c7f:' + t, { cwd: ROOT, maxBuffer: 64 << 20 })); }
const run = (f, target) => cp.spawnSync(process.execPath, [path.join(FX, f), target], { encoding: 'utf8' });
const list = fs.readdirSync(FX).filter(f => f.endsWith('.test.cjs')).sort();
ck('eighteen fixtures present', list.length === 18, String(list.length));
for (const f of list) { const t = TARGETS.find(t => run(f, path.join(ROOT, t)).status === 0);
  ck(f.replace('.test.cjs', '') + ': passes on this tree' + (t ? ' (' + t + ')' : ''), !!t);
  ck(f.replace('.test.cjs', '') + ': CONTROL fails on v1360', !!t && run(f, ctl[t]).status !== 0); }
console.log('test_actual_credit_1361.js: ' + P + ' passed, ' + F + ' failed'); process.exit(F ? 1 : 0);
