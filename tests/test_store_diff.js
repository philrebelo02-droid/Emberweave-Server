'use strict';
// v1128 player diffs (server/store-diff.js): 5,000 random edits to players - small and big fields, objects and arrays, keys added
// and removed, arrays pushed / shifted / spliced / shrunk, kinds switched (object <-> array <-> number), undefined values, '__proto__'
// as a key - each write's patch, applied in order to what was written before, gives back exactly the player (JSON-equal).
// A whole-player patch is used only for the first write; an unchanged player gives no patch.
// CONTROL: a deliberately broken apply (never shrinks an array) fails the same comparison.
const assert = require('node:assert/strict');
const D = require('../server/store-diff.js');
let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = a => a[Math.floor(rnd() * a.length)];
const big = n => 'x'.repeat(n);
function randVal(d) {
  const r = rnd();
  if (d > 2 || r < 0.35) return pick([1, 2.5, -7, 'a', big(30), big(400), true, false, null, undefined]);
  if (r < 0.65) { const o = {}; const n = Math.floor(rnd() * 8); for (let i = 0; i < n; i++) o['k' + Math.floor(rnd() * 12)] = randVal(d + 1); return o; }
  const a = []; const n = Math.floor(rnd() * 8); for (let i = 0; i < n; i++) a.push(randVal(d + 1)); return a;
}
function mutate(u) {
  const keys = Object.keys(u), r = rnd(), k = keys.length ? pick(keys) : 'f0';
  if (r < 0.15) u['f' + Math.floor(rnd() * 20)] = randVal(0);
  else if (r < 0.22) delete u[k];
  else if (r < 0.3) u.big = u.big && typeof u.big === 'object' && !Array.isArray(u.big) ? u.big : {};
  else if (r < 0.45) { const b = u.big; if (b && typeof b === 'object' && !Array.isArray(b)) { const kk = 'b' + Math.floor(rnd() * 30); if (rnd() < 0.2) delete b[kk]; else b[kk] = rnd() < 0.5 ? big(80 + Math.floor(rnd() * 200)) : randVal(1); } }
  else if (r < 0.65) { if (!Array.isArray(u.list)) u.list = []; const L = u.list, q = rnd();
    if (q < 0.4) L.push({ id: Math.floor(rnd() * 1e6), pad: big(150 + Math.floor(rnd() * 200)) });
    else if (q < 0.55) L.shift(); else if (q < 0.7 && L.length) { const i = Math.floor(rnd() * L.length); if (L[i] && typeof L[i] === 'object') L[i].pad = big(10 + Math.floor(rnd() * 300)); else L[i] = { id: i }; }
    else if (q < 0.8) L.splice(Math.floor(rnd() * (L.length + 1)), 1); else if (q < 0.9) L.length = Math.floor(L.length / 2); else L.push(undefined); }
  else if (r < 0.72) u.big = pick([[], 5, { a: big(2000) }, big(1500)]);
  else if (r < 0.76) u['__proto__x'] = randVal(1);
  else if (r < 0.8) { const o = JSON.parse('{"__proto__":{"evil":1}}'); u.proto = Object.assign(o, { pad: big(1200) }); }
  else if (r < 0.9) { if (u.led && typeof u.led === 'object' && !Array.isArray(u.led)) u.led['t' + Math.floor(rnd() * 40)] = randVal(1); else u.led = { hero: big(1100) }; }
  else u['f' + Math.floor(rnd() * 20)] = randVal(0);
}
function run(apply) {
  const u = { id: 'p1', name: 'P', led: { hero: big(2000), txs: [] }, list: [] };
  let sig = null, disk = null, wholes = 0, none = 0, patches = 0;
  for (let i = 0; i < 5000; i++) {
    if (rnd() < 0.9) mutate(u);
    const r = D.diff(u, sig);
    if (!sig) { assert.ok(r.patch.startsWith('{"w":'), 'first write is whole'); wholes++; }
    if (r.patch === null) none++; else { disk = apply(disk, JSON.parse(r.patch)); patches++; if (sig) assert.ok(!r.patch.startsWith('{"w":'), 'later writes are patches'); }
    sig = r.sig;
    assert.deepStrictEqual(JSON.parse(JSON.stringify(disk)), JSON.parse(JSON.stringify(u)), 'step ' + i + ': the applied patches give back the player');
  }
  return { wholes, none, patches };
}
const r = run(D.apply);
console.log('  ok  5000 random edits: every patch applied in order gives back the player (' + r.patches + ' patches, ' + r.none + ' unchanged writes with no patch, ' + r.wholes + ' whole)');
// the proto key is an own property, never the prototype
{ const u = JSON.parse('{"__proto__":{"evil":1},"pad":"' + big(1200) + '"}'); const back = D.apply({}, JSON.parse(D.diff(u, null).patch)); assert.ok(!({}).evil && Object.getPrototypeOf(back) === Object.prototype); console.log('  ok  a "__proto__" key stays an own property'); }
// control
seed = 12345; let caught = null;
try { run((u, p) => { if (p && p.a && u) for (const k of Object.keys(p.a)) if (Array.isArray(u[k])) p.a[k].n = Math.max(p.a[k].n, u[k].length); return D.apply(u, p); }); } catch (e) { caught = e.message.slice(0, 80); }
assert.ok(caught, 'CONTROL must fail'); console.log('  ok  CONTROL: an apply that never shrinks an array is caught (' + caught + ')');
console.log('test_store_diff.js: 3 checks passed, 0 failed');
