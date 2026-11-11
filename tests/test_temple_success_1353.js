// v1353 (Phil 10 Nov 2026: "i need the rates of success lower" / "people are maxing too fast" / "the rate of success is meant to reduce
// depending on the % of completion and temple level" / "go with strong"). Roll 1 (gain or loss) = START by Temple band x (1 - 0.5 x completion),
// the same for every tier. CONTROL: live v1352 (git show 96ce1e9c) where Inferno had no pressure and Temple level changed nothing.
const path = require('path'), cp = require('child_process'), fs = require('fs'), os = require('os');
const ROOT = path.join(__dirname, '..'); const T = require(path.join(ROOT, 'server', 'temple-of-ash.js'));
let P = 0, F = 0; const ck = (n, c, x) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n + (x !== undefined ? ' - ' + JSON.stringify(x) : '')); } };
const near = (a, b) => Math.abs(a - b) < 1e-9;
ck('start rate by Temple band: 90 / 80 / 70 / 60 / 50 / 40 %', [1, 5, 9, 13, 16, 19].map(L => T.successChance(L, 0)).join() === '0.9,0.8,0.7,0.6,0.5,0.4');
ck('inside a band the rate does not move (levels 4, 8, 12, 15, 18, 30)', [4, 8, 12, 15, 18, 30].map(L => T.successChance(L, 0)).join() === '0.9,0.8,0.7,0.6,0.5,0.4');
ck('a full hero prays at half its band rate', [1, 9, 19].every(L => near(T.successChance(L, 1), T.successChance(L, 0) / 2)));
ck('half full = three quarters of the band rate', near(T.successChance(19, 0.5), 0.3) && near(T.successChance(1, 0.5), 0.675));
ck('completion is clamped to 0..1', near(T.successChance(19, -3), 0.4) && near(T.successChance(19, 7), 0.2));
// measured in the real engine: share of gains over many prayers, per tier, at Temple 19 on an empty and on a full-ish hero
const lvl = L => { for (let p = 0; p < 5e7; p += 500) if (T.keeperLevel(p, 100) >= L) return p; return 5e7; };
function share(tier, L, steps, n) { let g = 0; let s = 12345; T.setRng(() => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; });
  for (let i = 0; i < n; i++) { const st = T.newState(); st.playerLevel = 100; st.keeperPoints = lvl(L);
    const bars = T.heroBars ? T.heroBars('vael') : null; st.heroes = { vael: T.newHero ? T.newHero('vael') : {} };
    const hs = st.heroes.vael; if (hs.steps) for (const k in hs.steps) hs.steps[k] = steps; else hs.steps = Object.fromEntries((bars || T.CONFIG.BARS).map(b => [b, steps]));
    const r = T.pray(st, 'vael', tier); if (r && r.gain) g++; T.discardSession(st); }
  T.setRng(null); return g / n; }
const N = 4000, tol = 0.03;
for (const tier of ['gold', 'kindled', 'stoked', 'blazing', 'inferno']) {
  const a = share(tier, 19, 0, N), b = share(tier, 19, 100, N);
  ck(tier + ' at Temple 19: empty hero ~40%, half-full hero ~30% (measured ' + (a * 100).toFixed(1) + '% / ' + (b * 100).toFixed(1) + '%)', Math.abs(a - 0.40) < tol && Math.abs(b - 0.30) < tol, [a, b]); }
{ const a = share('gold', 1, 0, N); ck('Temple 1 (Gold ritual, the only tier open): empty hero ~90% (measured ' + (a * 100).toFixed(1) + '%)', Math.abs(a - 0.90) < tol, a); }
// CONTROL: the live module (v1352) gave Inferno ~95% at Temple 19 on a half-full hero
{ const tmp = path.join(os.tmpdir(), 'temple-v1352-' + process.pid + '.js'); fs.writeFileSync(tmp, cp.execSync('git show 96ce1e9c:server/temple-of-ash.js', { cwd: ROOT, maxBuffer: 64 << 20 }));
  const O = require(tmp); ck('CONTROL: v1352 had no successChance and Inferno had no pressure at the cap', typeof O.successChance !== 'function' && O.pressureChance('inferno', 200, 200) === 0); fs.unlinkSync(tmp); }
console.log('test_temple_success_1353.js: ' + P + ' passed, ' + F + ' failed'); process.exit(F ? 1 : 0);
