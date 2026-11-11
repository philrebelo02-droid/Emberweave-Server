// v1363 (ChatGPT audit round 5, D batch 4): five more controls (World map march retreat, garrison return, server march retreat, Emberdraft Buy, Emberdraft Solo) - the same rule as v1362: ten controls that could stay disabled or busy after a thrown or refused
// request are always released (Arena attempt, Forge action, Skyfall assault, Tower, World shield, Guild approve / deny, Temple Auto pray, Hero
// equipment action / plan equip / build), and the server replays Province and Starless Well fights in the mode they were played in (the replay
// fought stronger enemies: digest differed on 23 of 24 province stages). Each fixture runs the real code text. CONTROL: each fails on v1361.
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const ROOT = path.join(__dirname, '..'), FX = path.join(__dirname, 'fixtures_1363');
let P = 0, F = 0; const ck = (n, c, x) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n + (x ? ' - ' + x : '')); } };
const TARGETS = ['server.js', 'server/starless-well.js', 'emberweave-heroes.html', '.'];   // '.' = a fixture that takes the tree root
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ac1363-')); const ctl = {};
fs.mkdirSync(path.join(tmp, 'server'));
for (const t of TARGETS) { if (t === '.') { ctl[t] = tmp; continue; } ctl[t] = path.join(tmp, t); fs.writeFileSync(ctl[t], cp.execSync('git show c522bbbb:' + t, { cwd: ROOT, maxBuffer: 64 << 20 })); }
const run = (f, target) => cp.spawnSync(process.execPath, [path.join(FX, f), target], { encoding: 'utf8' });
const list = fs.readdirSync(FX).filter(f => f.endsWith('.test.cjs')).sort();
ck('five fixtures present', list.length === 5, String(list.length));
for (const f of list) { const t = TARGETS.find(t => run(f, path.join(ROOT, t)).status === 0);
  ck(f.replace('.test.cjs', '') + ': passes on this tree' + (t ? ' (' + t + ')' : ''), !!t);
  ck(f.replace('.test.cjs', '') + ': CONTROL fails on v1362', !!t && run(f, ctl[t]).status !== 0); }
console.log('test_stuck_controls_1363.js: ' + P + ' passed, ' + F + ' failed'); process.exit(F ? 1 : 0);
