// v1364 (night smoke, heroes): a refused /api/glyphs/build-tree read (429) was forgotten at once, so every redraw of the hero list asked again
// for every hero - a burst of 429s on each filter change. A failed read rests 15 s and the queue rests 3 s. Real function text. CONTROL: v1363 floods.
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
let P = 0, F = 0; const ck = (n, c, x) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n + (x ? ' - ' + x : '')); } };
async function run(src, fail) {
  const a = src.indexOf('const HUP_GLY={}'), b = src.indexOf('function heroUpgrades(', a); if (a < 0 || b < a) throw new Error('not found');
  let calls = 0, dots = 0; const timers = [];
  const ctx = { console, Promise, Date, encodeURIComponent, window: {}, setTimeout: (f, ms) => { timers.push([f, ms]); return timers.length; },
    RUNE2: { st: { revision: 1 }, cat: { ladder: [1, 2, 3] } }, ACC: { token: 't' }, heroOwned: () => true, heroLevel: () => 60,
    g2board: () => ({ ascensionIndex: 0, slots: [null, null, null, null, null, null], levelRequired: 1 }),
    api: async () => { calls++; return fail ? { error: 'rate' } : { canBuild: true }; }, heroUpDotsRefresh: () => { dots++; } };
  vm.runInNewContext(src.slice(a, b) + '\nthis.go=heroGlyphCanUp;', ctx);
  const tick = () => new Promise(r => setImmediate(r));
  for (let redraw = 0; redraw < 8; redraw++) { for (let h = 0; h < 30; h++) ctx.go('hero' + h); for (let i = 0; i < 6; i++) await tick(); }
  return { calls, dots, timers };
}
(async () => {
  const src = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8');
  const bad = await run(src, true), good = await run(src, false);
  ck('refused reads: 8 redraws of 30 heroes send 2 requests, then the queue rests', bad.calls === 2, String(bad.calls));
  ck('a failed hero is asked again only after 15 s', bad.timers.some(t => t[1] === 15000));
  ck('working reads: each hero is asked once and the dots refresh', good.calls === 30 && good.dots === 30, good.calls + '/' + good.dots);
  let old = null; try { old = await run(cp.execSync('git show e68f7437:emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }).toString(), true); } catch (e) { console.log(e.message); }
  ck('CONTROL: v1363 asked again on every redraw', !!old && old.calls > 30, old && String(old.calls));
  console.log('test_glyph_dot_backoff_1364.js: ' + P + ' passed, ' + F + ' failed'); process.exit(F ? 1 : 0);
})();
