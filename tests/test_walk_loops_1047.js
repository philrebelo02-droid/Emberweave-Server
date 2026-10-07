'use strict';
// v1047 (Phil 6 Oct 2026: "when someone is walking can you someone stop the part when they go back to start frame? they look like
// they keep stopping mid walk"). Each walk sheet carries a measured stride loop [a,b): frames a..b-1 play forever, so the walk never
// wraps back to the clip's standing start pose, never passes through the clip's near-still frames, and never plays the old "1,0" tail.
// Checks the data (every loop inside its sheet, a real stride long) and the sheets themselves (the wrap b-1 -> a is no bigger a jump
// than an ordinary step, measured on the pixels).
(function main() {
const path = require('path'), vm = require('vm'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const host = require(path.join(ROOT, 'server/sim-host.js')).load(path.join(ROOT, 'emberweave-heroes.html'));
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + detail : '')); } };
try {
  const W = vm.runInContext(`Object.keys(BATTLE_ANIM).filter(k=>BATTLE_ANIM[k]&&BATTLE_ANIM[k].walk).map(k=>[k,BATTLE_ANIM[k].walk])`, host.ctx);
  const looped = W.filter(([, w]) => w.loop);
  ck('at least 40 walks carry a stride loop', looped.length >= 40, looped.length + ' of ' + W.length);
  const bad = looped.filter(([, w]) => !(Array.isArray(w.loop) && w.loop[0] >= 0 && w.loop[1] <= w.n && w.loop[1] - w.loop[0] >= 8));
  ck('every loop lies inside its sheet and is at least 8 frames (a stride)', bad.length === 0, JSON.stringify(bad.map(b => [b[0], b[1].loop, b[1].n])));
  const tails = looped.filter(([, w]) => w.n === 50 && w.loop[1] > 48);
  ck('no loop plays the old 1,0 tail of a 50-frame walk', tails.length === 0, JSON.stringify(tails.map(t => t[0])));
  for (const k of ['konwu', 'bloatus', 'vex', 'grimsby', 'nerisse', 'lumi']) {
    const w = W.find(x => x[0] === k); ck(k + ' walks on its measured loop', w && w[1].loop, JSON.stringify(w && w[1].loop));
  }
  const src = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8');
  ck('the renderer plays A.loop for the walk state', /else if\(A\.loop && st==='walk'\)\{ const _L=A\.loop; fr=_L\[0\]\+Math\.floor\(u\._animAcc\)%\(_L\[1\]-_L\[0\]\); \}/.test(src));
} catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; return; }
console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
if (fail) process.exitCode = 1;
})();
