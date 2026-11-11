// v1364 (tester reports 11 Nov): the crew's fixtures for this release. Each must FAIL on v1363 (e68f7437) and PASS on this tree.
// Fixtures take the tree root as their argument. Add new ones to tests/fixtures_1364/.
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const ROOT = path.join(__dirname, '..'), FX = path.join(__dirname, 'fixtures_1364');
let P = 0, F = 0; const ck = (n, c, x) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n + (x ? ' - ' + x : '')); } };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tf1364-'));
fs.writeFileSync(path.join(tmp, 'emberweave-heroes.html'), cp.execSync('git show e68f7437:emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }));
fs.mkdirSync(path.join(tmp, 'server'), { recursive: true });
try { fs.writeFileSync(path.join(tmp, 'server.js'), cp.execSync('git show e68f7437:server.js', { cwd: ROOT, maxBuffer: 64 << 20 })); } catch (e) {}
const run = (f, root) => cp.spawnSync(process.execPath, [path.join(FX, f), root], { encoding: 'utf8' });
for (const f of fs.readdirSync(FX).filter(f => f.endsWith('.test.cjs')).sort()) {
  const n = f.replace('.test.cjs', ''), now = run(f, ROOT), old = run(f, tmp);
  ck(n + ': passes on this tree', now.status === 0, (now.stderr || '').split('\n').slice(0, 3).join(' '));
  ck(n + ': CONTROL fails on v1363', old.status !== 0);
}
console.log('test_tester_fixtures_1364.js: ' + P + ' passed, ' + F + ' failed'); process.exit(F ? 1 : 0);
