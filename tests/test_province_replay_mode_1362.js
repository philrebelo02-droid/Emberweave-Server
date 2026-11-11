// v1362 (found by Claude's stage audit, fixed by ChatGPT): the server replayed Training Province and Starless Well fights in 'campaign' mode,
// where enemies get skill level = their own level; the live fight runs in 'province' / 'well' mode. The replay fought STRONGER enemies than the
// player did (digest differed on 23 of 24 province stages, win/loss flipped on 6), so honest wins logged a digest-mismatch incident.
// The fixture replays an authored Province stage with a fixed squad and seed through the real sim host of two trees. CONTROL: the v1361 tree
// (git archive f4f4a291) against itself fails; this tree passes, and its Campaign 1-1 replay receipt is byte-identical to v1361's.
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const ROOT = path.join(__dirname, '..'); let P = 0, F = 0; const ck = (n, c, x) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n + (x ? ' - ' + x : '')); } };
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'prov1362-'));
for (const f of cp.execSync('git ls-tree -r --name-only f4f4a291 server', { cwd: ROOT }).toString().split('\n').filter(Boolean).concat(['server.js', 'emberweave-heroes.html'])) {
  const out = path.join(base, f); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, cp.execSync('git show f4f4a291:' + f, { cwd: ROOT, maxBuffer: 128 << 20 })); }
// the page's own script files (unchanged since v1361) come from this tree
const html = fs.readFileSync(path.join(base, 'emberweave-heroes.html'), 'utf8');
for (const m of html.matchAll(/<script[^>]*\ssrc="([^"?]+)[^"]*"/g)) { const src = m[1].replace(/^\//, ''), from = path.join(ROOT, src), to = path.join(base, src); if (fs.existsSync(from) && !fs.existsSync(to)) { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); } }
const fx = path.join(__dirname, 'fixtures_1362b', 'province-well-replay-mode.test.cjs');
const run = (a, b) => cp.spawnSync(process.execPath, [fx, a, b], { encoding: 'utf8', timeout: 240000 });
const good = run(base, ROOT); ck('this tree: Province and Well replays match the live mode; Campaign 1-1 receipt unchanged', good.status === 0, (good.stderr || '').split('\n').slice(0, 4).join(' ').slice(0, 300));
const ctl = run(base, base); ck('CONTROL v1361 against itself: the Province digest comparison fails', ctl.status !== 0 && /digest|Province|province|AssertionError/.test(ctl.stderr || ''), (ctl.stderr || '').split('\n').slice(0, 3).join(' ').slice(0, 200));
console.log('test_province_replay_mode_1362.js: ' + P + ' passed, ' + F + ' failed'); process.exit(F ? 1 : 0);
