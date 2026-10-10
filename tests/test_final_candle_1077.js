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
ok(c.includes('_caught.forEach(e=>_encase(e,candleEdgeT(dist(_c,e)/_R)));'), "each hero's stun time comes from its own distance");
ok(c.includes("_enc.push(e); ccApply(u,e,'stunned',o.stun||1.5);"), 'stun length unchanged');
ok(c.includes("delay:at+(o.shatter||1.5),run:function(){ if(!e.alive||_enc.indexOf(e)<0)return; dealDamage(u,e,_sh,"), 'the shatter hits only an encased hero, o.shatter after its own stun');
// v1101 (Phil 9 Oct): "everyone touched by waxens ult should be stunned and the effigy should appear on them" / "even if they are pulled into
// it while its pouring" - run the REAL case body with stubs and move enemies around during the pour.
{ const body = c.slice(c.indexOf('{') + 1, c.lastIndexOf('break;'));
  const S = { hz: [], stun: new Set(), eff: new Set(), hit: new Set() };
  const mk = (id, x) => ({ id, x, y: 0, alive: true });
  const A = mk('in-then-out', 1 * 32), B = mk('pulled-in', 12 * 32), C = mk('pulled-in-and-out', 12 * 32), D = mk('never-touched', 20 * 32);
  const env = { u: { x: 0, y: 0 }, o: { radius: 7 * 32, mul: 2, slow: 3, stun: 1.5, shatter: 1.5, coat: 6 }, aimCtr: { x: 0, y: 0 }, tgt: null, apB: 10, rm: 1, METER: 32,
    nearestEnemy: () => null, enemiesOf: () => [A, B, C, D], dist: (p, q) => Math.hypot(p.x - q.x, p.y - q.y), groundHazards: S.hz,
    ccApply: (u, e, k) => { if (k === 'stunned') S.stun.add(e.id); }, floatTexts: { push() {} }, ringBurst() {}, burstAt() {},
    dealDamage: (u, e) => S.hit.add(e.id), candleCastFx() {}, candleEffigyFx: (e) => S.eff.add(e.id), candleEdgeT: ctx.T, candleEdgeF: ctx.F, Math };
  vm.runInNewContext('(function(){' + body + '})()', env);
  // v1112 (Phil 10 Oct: "the wax needs to hit them first"): at the moment of the cast nobody is coated yet - the coat waits for the edge
  ok([A, B, C, D].every(e => !e._waxCoatT), 'v1112: no enemy is waxed at the cast - the wax has not reached anyone yet (the old code coated A at once)');
  const coatAt = {};
  // the fight loop: hazards fire in time order; move enemies as the pour runs (A steps out at once, B is pulled in at 2 s, C in at 2 s and out at 2.3 s)
  const fired = new Set(); let t = 0;
  while (t < 9) { t = +(t + 0.05).toFixed(2);
    if (t === 0.1) A.x = 15 * 32; if (t === 2) { B.x = 0.5 * 32; C.x = 0.5 * 32; } if (t === 2.3) C.x = 15 * 32;
    for (let i = 0; i < S.hz.length; i++) { const h = S.hz[i]; if (!fired.has(h) && (h._t = h._t ?? t - 0.05 + 0) >= 0 && t >= (h._at = h._at ?? (h._born ?? (h._born = t - 0.05)) + h.delay)) { fired.add(h); h.run(); } }
    for (const e of [A, B, C, D]) if (e._waxCoatT && coatAt[e.id] == null) coatAt[e.id] = t;}
  ok(S.stun.has('in-then-out') && S.eff.has('in-then-out') && S.hit.has('in-then-out'), 'caught at the cast then stepped out: still encased, effigy, shatter');
  ok(S.stun.has('pulled-in') && S.eff.has('pulled-in') && S.hit.has('pulled-in'), 'pulled into the wax while it pours: encased, effigy, shatter');
  ok(S.stun.has('pulled-in-and-out') && S.eff.has('pulled-in-and-out'), 'pulled in and out again mid-pour: still encased');
  ok(!S.stun.has('never-touched') && !S.eff.has('never-touched'), 'CONTROL: an enemy the wax never touches is not encased');
  ok([A, B, C].every(e => e._waxCoatT === 6 && e._waxCoatBy === env.u) && !D._waxCoatT, 'every touched enemy carries her 6 s wax coat (refreshed when it shatters); control: the untouched one has none');
  ok(c.includes("dealDamage(u,e,_sh,'#fff0c0','magic'); _coat(e);"), 'the coat goes on again when the effigy shatters');
  ok(Math.abs(coatAt['in-then-out'] - ctx.T(1 / 7)) <= 0.101, 'v1112: the enemy 1 m out is waxed when the edge reaches 1 m (' + coatAt['in-then-out'] + ' s vs edge ' + ctx.T(1 / 7).toFixed(2) + ' s), not at the cast'); }
ok(c.includes("_coat(e); ccApply(u,e,'slow',o.slow||3); floatTexts.push({x:e.x,y:e.y-8,txt:'WAX'") && c.includes('delay:Math.max(0.01,candleEdgeT(dist(_c,e)/_R)),run:function(){ if(!e.alive)return;'), 'the WAX slow + coat land when the edge reaches each caught enemy (v1112)');
// v1112 (Phil 10 Oct: "please make wax reduce healing on the enemy effected by 30%"): run the real first line of healUnit with stubs
{ const hs = H.indexOf('function healUnit(u,a){'), he = H.indexOf('u.hp+=a;', hs);
  const head = H.slice(hs, he) + 'u.hp+=a; }';
  const env2 = { worldHealCap: u => u.maxHp, WAX_HEAL_CUT: 0.30 }; vm.runInNewContext(head + '\nthis.heal=healUnit;', env2);
  const mk = x => Object.assign({ hp: 100, maxHp: 1000, mortalT: 0 }, x);
  const plain = mk({}), coat = mk({ _waxCoatT: 3 }), tallow = mk({ _waxT: 2, _wax: 1 }), spent = mk({ _waxT: 0, _wax: 2 });
  [plain, coat, tallow, spent].forEach(u => env2.heal(u, 100));
  ok(coat.hp === 170 && tallow.hp === 170, 'v1112: a waxed enemy (ult coat or Living Tallow stacks) heals 30% less: 100 -> 70');
  ok(plain.hp === 200 && spent.hp === 200, 'CONTROL: no wax (or wax that has run out) heals in full'); }
ok(H.includes("ceraline:{deliver:'form',noArt:true}"), 'the old ult plate is off (delivery timing kept)');
ok(H.includes('killAllWaxFx(); clearCandleFx(); }'), 'cleared with the other FX');
// CONTROL: the display helpers never touch the fight
const i0 = H.indexOf('function candleCastFx'), i1 = H.indexOf('/* v1076 Sealing Wax');
const fx = i0 >= 0 ? H.slice(i0, i1) : 'dealDamage';
ok(!/dealDamage|ccApply|\.hp\s*[-+]?=|groundHazards|stunned/.test(fx), 'CONTROL: the art code touches no damage, CC or hazards');

console.log('\nPASS: ' + pass + '  FAIL: ' + fail);
process.exit(fail ? 1 : 0);
