'use strict';
// Gruel nine (Phil 9 Oct 2026, ChatGPT handoff GRUEL-NINE-09OCT2026-ULT4-PASSIVE7, "pass send to claude"): the nine approved
// clips are wired as sheets. Checks every gruel sheet exists, its file is exactly the declared grid, the grid fits the 4096
// texture limit, the anchors sit inside the cell, the ?v= is new, blue plays the bounded 1-48-1 motion (pingpong, 94-frame
// period), and the kit (Coinflail / Weigh the Debt / Gluttony) is unchanged - this was an animation-only change.
// A control runs the same grid check on a deliberately broken copy and must fail.
(function main() {
const path = require('path'), vm = require('vm'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..');
const host = require(path.join(ROOT, 'server/sim-host.js')).load(path.join(ROOT, 'emberweave-heroes.html'));
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + detail : '')); } };
function webpSize(file) {   // VP8L (lossless) / VP8X header - no image library needed
  const b = fs.readFileSync(file);
  const tag = b.toString('ascii', 12, 16);
  if (tag === 'VP8L') { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
  if (tag === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (tag === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
  return null;
}
function gridProblems(G) {
  const bad = [];
  for (const [st, A] of Object.entries(G)) {
    const f = path.join(ROOT, A.u.split('?')[0]);
    if (!fs.existsSync(f)) { bad.push(st + ' missing'); continue; }
    const sz = webpSize(f);
    if (A.n > A.cols * A.rows) bad.push(st + ' n>grid');
    if (A.fw * A.cols > 4096 || A.fh * A.rows > 4096) bad.push(st + ' >4096');
    if (!sz || sz[0] !== A.fw * A.cols || sz[1] !== A.fh * A.rows) bad.push(st + ' file ' + sz + ' != grid');
    if (!(A.feet > 0 && A.feet <= A.fh && A.cx > 0 && A.cx < A.fw && A.top < A.feet)) bad.push(st + ' anchor outside cell');
  }
  return bad;
}
try {
  const G = vm.runInContext('JSON.parse(JSON.stringify(BATTLE_ANIM.gruel))', host.ctx);
  const states = ['idle', 'walk', 'attack', 'crit', 'hit', 'green', 'blue', 'ult', 'passive'];
  ck('Gruel has all nine states', states.every(s => G[s]), Object.keys(G).join(','));
  const bad = gridProblems(G);
  ck('every sheet exists, file = declared grid, fits 4096, anchors in cell', bad.length === 0, bad.join('; '));
  ck('every sheet carries the new ?v=22', states.every(s => /\?v=22$/.test(G[s].u)));
  ck('attack and crit land on the contact frame (relFrac 0.375 = 18/48)', G.attack.relFrac === 0.375 && G.crit.relFrac === 0.375);
  ck('walk plays its measured stride loop [1,43)', JSON.stringify(G.walk.loop) === '[1,43]');
  const per = vm.runInContext('ppPer(BATTLE_ANIM.gruel.blue)', host.ctx);
  ck('blue is the bounded 1-48-47-1 motion (pingpong, 94-frame period)', G.blue.pingpong === true && G.blue.n === 48 && per === 94, 'period ' + per);
  const kit = vm.runInContext('JSON.stringify(KITS.gruel)', host.ctx);
  ck('kit unchanged (animation-only change)', kit === '{"green":{"deliver":"form","name":"Coinflail","type":"cleavecone","mul":1.3,"radius":' +
    vm.runInContext('3*METER', host.ctx) + ',"angle":70,"cd":7,"gfx":"gruel_green","gdur":5.88},"blue":{"name":"Weigh the Debt","type":"weighdebt","mul":1,"pct":0.35,"dur":6,"cd":10,"gfx":"gruel_blue","gfxR":' +
    vm.runInContext('3*METER', host.ctx) + ',"gdur":5.88},"purple":{"name":"Gluttony","pass":"juggernaut"}}', kit);
  const ctl = JSON.parse(JSON.stringify(G)); ctl.crit.u = '/assets/anim/gruel/gruel_missing.webp?v=22'; ctl.walk.fw = 700;
  ck('control: the grid check catches a missing sheet and an oversized grid', gridProblems(ctl).length >= 2);
} catch (e) { console.log('FAIL after ' + pass + ' checks: ' + (e.stack || e.message)); process.exitCode = 1; return; }
console.log((fail ? 'FAIL ' : 'PASS ') + pass + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
if (fail) process.exitCode = 1;
})();
