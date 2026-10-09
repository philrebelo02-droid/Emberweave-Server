// v1077 - Court of the Final Candle (Ceraline ult, Grok spell 21, Phil-approved 8 Oct): the wax pours at the aim point and spreads to
// the full 7 m radius (14 m across); each caught hero is encased (stun) when the edge reaches it and shatters o.shatter s later.
// Rig: stuns in distance order (0.5 m 1.48 s ... 6.5 m 3.03 s), each shatter 1.5 s after its stun; pot, pool, effigies, bursts seen.
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = path.join(__dirname, '..');
const H = fs.readFileSync(path.join(R, 'emberweave-heroes.html'), 'utf8');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };

for (const k of ['candlepot', 'candlepool', 'candleburst', 'candleeffigy']) {
  const m = H.match(new RegExp('\\n\\s*' + k + ":\\{u:'([^']+)',n:(\\d+),fw:(\\d+),fh:(\\d+),cols:(\\d+),rows:(\\d+)"));
  ok(m && fs.existsSync(path.join(R, m[1].split('?')[0])) && +m[2] <= +m[5] * +m[6] && +m[3] * +m[5] <= 4096 && +m[4] * +m[6] <= 4096, k + ' sheet on disk, grid fits');
}
// the edge table, run as plain JS
const tbl = H.match(/const CANDLE_EDGE=(\[\[[^\n;]*\]\]);/);
const fT = H.match(/function candleEdgeT\(f\)\{[^\n]*/);
const fF = H.match(/function candleEdgeF\(t\)\{[^\n]*/);
ok(tbl && fT && fF, 'the edge table and its two lookups exist');
const ctx = { T: () => NaN, F: () => NaN };
if (tbl && fT && fF) vm.runInNewContext('const CANDLE_EDGE=' + tbl[1] + ';\n' + fT[0] + '\n' + fF[0] + '\nthis.T=candleEdgeT; this.F=candleEdgeF;', ctx);
ok(Math.abs(ctx.T(0) - 0.92) < 1e-6 && Math.abs(ctx.T(1) - 5.5) < 1e-6, 'the edge lands at 0.92 s and reaches the full radius at 5.5 s');
let mono = true; for (let f = 0.05; f <= 1.0001; f += 0.05) if (!(ctx.T(f) >= ctx.T(f - 0.05))) mono = false;
ok(mono, 'a hero further out is always encased later');
ok(Math.abs(ctx.F(ctx.T(0.5)) - 0.5) < 1e-6, 'the floor art grows on the same table the logic uses');
const c = H.slice(H.indexOf("case 'finalcandle':{"), H.indexOf("case 'swamproot':{"));
ok(c.includes('const at=candleEdgeT(dist(_c,e)/_R);'), "each hero's stun time comes from its own distance");
ok(c.includes("delay:at,run:function(){ if(!e.alive||dist(_c,e)>=_R)return; _enc.push(e); ccApply(u,e,'stunned',o.stun||1.5);"), 'encased only if still inside the pool when the edge arrives; stun length unchanged');
ok(c.includes("delay:at+(o.shatter||1.5),run:function(){ if(!e.alive||_enc.indexOf(e)<0)return; dealDamage(u,e,_sh,"), 'the shatter hits only an encased hero, o.shatter after its own stun');
ok(c.includes("_caught.forEach(e=>{ ccApply(u,e,'slow',o.slow||3);"), 'the WAX slow on caught enemies is unchanged');
ok(H.includes("ceraline:{deliver:'form',noArt:true}"), 'the old ult plate is off (delivery timing kept)');
ok(H.includes('killAllWaxFx(); clearCandleFx(); }'), 'cleared with the other FX');
// CONTROL: the display helpers never touch the fight
const i0 = H.indexOf('function candleCastFx'), i1 = H.indexOf('/* v1076 Sealing Wax');
const fx = i0 >= 0 ? H.slice(i0, i1) : 'dealDamage';
ok(!/dealDamage|ccApply|\.hp\s*[-+]?=|groundHazards|stunned/.test(fx), 'CONTROL: the art code touches no damage, CC or hazards');

console.log('\nPASS: ' + pass + '  FAIL: ' + fail);
process.exit(fail ? 1 : 0);
