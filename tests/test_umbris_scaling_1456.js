// v1456 (Phil 26 Nov 2026: "make sure all of umbris's abilities scale properly"): every damage number Umbris deals, measured in the fight engine
// headless (server/sim-host.js through tests/talents-lab.js - the still field: units held, no rendering). For each one: what it scales off
// (Ability Power for his three skills - he is a Magic hero; Attack for his basic bolt, as every non-hybrid hero), that doubling the stat doubles it,
// that a running damage buff raises it, that the skill level raises it, that hero level / stars / gear Ability Power reach it through his Ability
// Power, and that the number on the skill card is the number the fight deals.
// The fix it guards: Creeping Rot's rot read raw Ability Power x skill level (the plain 'dot' path), so a damage buff never reached it while its own
// hit, Shadeburst's rot and the ultimate all took it. Now apB (as Pyroclast's Ember Lash, which shares the type). The plain 'dot' type (Vex, monsters)
// is unchanged on purpose - checked below. Also: the Pulled Apart talent (oc_9_4) now reads the buffed Ability Power, as the talent engine's 'apow'.
// Exit 0 = all passed.
'use strict';
const path = require('path'), vm = require('vm');
const L = require(path.join(__dirname, 'talents-lab.js'));
const { NOW, V, T, lab, secs, spec, snaps } = L;
const R = s => vm.runInContext(s, NOW.ctx);
let pass = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL ' + m); console.log('test_umbris_scaling_1456.js: FAILED after ' + pass + ' passed'); process.exit(1); } pass++; console.log('  ok   ' + m); };
const near = (a, b, eps) => Math.abs(a - b) <= (eps || 1e-6) * Math.max(1, Math.abs(b));
const f = x => (+x).toFixed(3);

// the raw amount of every hit Umbris (or Pyroclast / Vex) sends into dealDamage, before the target's defences
R(`window.__hits=[]; window.__who=null; const __dd0=dealDamage; dealDamage=function(a,b,amt){ if(a&&a.key===__who) __hits.push(amt); return __dd0.apply(this,arguments); };`);
const hits = () => JSON.parse(R('JSON.stringify(__hits)'));

/* one cast on a still field. o: {ap, atk, buff, lv (skill level), key, snap (a ready unit list for the ally side)} */
function cast(slot, o) {
  o = o || {}; const key = o.key || 'umbris';
  const P = lab(key, null, { foes: 3, big: true }); const { v, F } = P;
  if (o.ap != null) v.apow = o.ap; if (o.atk != null) v.dmg = o.atk;
  if (o.buff) { v.dmgBuffT = 99; v.dmgBuffMul = o.buff; }
  if (o.lv) v.skillLv = [o.lv, o.lv, o.lv, o.lv];
  F.forEach((e, i) => { e.dots.length = 0; e.x = F[0].x + i * 0.5 * V.METER; e.y = F[0].y; });
  R(`__who=${JSON.stringify(key)}; __hits.length=0; voidZones.length=0;`);
  if (slot === 'ult') { V.cast(v, 'ult', F[0]); v.stunned = 0; v.atkCd = 1e9; v.greenCd = 1e9; v.blueCd = 1e9; v.energy = 0;
    let k = 0; for (; k < 400 && (v._voidCast || v._voidT > 0 || v._voidLandT > 0); k++) V.step(1); v.stunned = 1e6; ok(k < 400, 'the orb landed'); }
  else V.cast(v, slot, F[0]);
  secs(0.6);   // his rots are queued 0.5 s (plagueDot)
  const dot = (F[0].dots.find(d => d.src === v) || {}).dps || 0;
  const zone = JSON.parse(R('JSON.stringify(voidZones.filter(z=>z.life>0).map(z=>z.pd))'))[0] || 0;
  return { hit: hits()[0] || 0, dot, zone, v, F, P };
}
const SM = lv => R('skillMul(' + lv + ')');
// the parts: [name, slot, field, coefficient]
const PARTS = [['Shadeburst rot (per second)', 'green', 'dot', 0.3], ['Creeping Rot hit', 'blue', 'hit', 0.5], ['Creeping Rot rot (per second)', 'blue', 'dot', 0.6],
  ['Umbral Cataclysm first hit', 'ult', 'hit', 1.6], ['Umbral Cataclysm zone (per second)', 'ult', 'zone', 0.6]];

console.log('== 1. Umbris is a Magic hero: his skills scale off Ability Power ==');
ok(R("HERO_TYPES.umbris.damageProfile") === 'Magic', 'damage profile Magic');
ok(R("heroScaleMode({t:HERO_TYPES.umbris})") === 'ap', 'heroScaleMode = ap (dB = apB)');
ok(R("KIT_SCALE.shadeburst") === 'Ability Power' && R("KIT_SCALE.creeprot") === 'Ability Power' && R("ULT_SCALE.umbralcata") === 'Ability Power', 'KIT_SCALE / ULT_SCALE label all three Ability Power');

console.log('== 2. every part = Ability Power x its coefficient x skill level (skill level 10) ==');
const base = {}; for (const s of ['green', 'blue', 'ult']) base[s] = cast(s, { ap: 100, lv: 10 });
for (const [n, s, k, c] of PARTS) ok(near(base[s][k], 100 * c * SM(10)), n + ': ' + f(base[s][k]) + ' = 100 AP x ' + c + ' x ' + f(SM(10)));

console.log('== 3. double the Ability Power = double every part ==');
const dbl = {}; for (const s of ['green', 'blue', 'ult']) dbl[s] = cast(s, { ap: 200, lv: 10 });
for (const [n, s, k] of PARTS) ok(near(dbl[s][k], 2 * base[s][k]), n + ': ' + f(base[s][k]) + ' -> ' + f(dbl[s][k]));

console.log('== 4. a running damage buff (+50%) raises every part by 50% (Creeping Rot\'s rot did not: the fix) ==');
const bf = {}; for (const s of ['green', 'blue', 'ult']) bf[s] = cast(s, { ap: 100, lv: 10, buff: 1.5 });
for (const [n, s, k] of PARTS) ok(near(bf[s][k], 1.5 * base[s][k]), n + ': ' + f(base[s][k]) + ' -> ' + f(bf[s][k]));

console.log('== 5. skill level raises every part (level 1 -> 10 = skillMul(10)/skillMul(1)) ==');
const l1 = {}; for (const s of ['green', 'blue', 'ult']) l1[s] = cast(s, { ap: 100, lv: 1 });
for (const [n, s, k] of PARTS) ok(near(base[s][k] / l1[s][k], SM(10) / SM(1)), n + ': ' + f(l1[s][k]) + ' -> ' + f(base[s][k]));

console.log('== 6. hero level, stars and gear Ability Power reach his skills through his Ability Power ==');
{ const apOf = sp => snaps([sp])[0].apow;
  const sp = (lvl, stars, fApow) => Object.assign(spec('umbris', lvl, null), { stars, fApow });
  // stars are flat stats (v1369 starFlat, part of heroFlatApow): the client sends them inside the spec's flat Ability Power
  const st = n => R('starFlatFrom(' + n + ',0,0).apow'), starAdd = st(5) - st(3);
  ok(starAdd > 0, 'stars 3 -> 5 add ' + starAdd + ' flat Ability Power (heroFlatApow)');
  const rows = [['level 50', sp(50, 3, 20)], ['level 100', sp(100, 3, 20)], ['5 stars', sp(100, 5, 20 + starAdd)], ['+180 gear AP', sp(100, 3, 200)]];
  const aps = rows.map(r => apOf(r[1]));
  ok(aps[1] > aps[0] && aps[2] > aps[1] && aps[3] > aps[1], 'Ability Power: ' + rows.map((r, i) => r[0] + ' ' + f(aps[i])).join(', '));
  for (let i = 0; i < rows.length; i++) { const c = cast('blue', { ap: aps[i], lv: 10 }), g = cast('green', { ap: aps[i], lv: 10 });
    ok(near(c.hit, aps[i] * 0.5 * SM(10)) && near(c.dot, aps[i] * 0.6 * SM(10)) && near(g.dot, aps[i] * 0.3 * SM(10)), rows[i][0] + ': Creeping Rot ' + f(c.hit) + ' + ' + f(c.dot) + '/s, Shadeburst ' + f(g.dot) + '/s follow its Ability Power'); } }

console.log('== 7. the skill card = the fight (same Ability Power, same skill level) ==');
{ R("G.skillLevel=G.skillLevel||{}; G.skillLevel.umbris=[10,10,10,10];");
  for (const ap of [100, 237]) {
    const card = JSON.parse(R(`JSON.stringify([0,1,2].map(i=>stripIcons(skillEffectStr('umbris',i,22,1000,${ap}))))`));
    const g = cast('green', { ap, lv: 10 }), b = cast('blue', { ap, lv: 10 }), u = cast('ult', { ap, lv: 10 });
    ok(card[1] === 'DoT ' + Math.round(g.dot) + '/s · 6s', 'AP ' + ap + ' Shadeburst card "' + card[1] + '" = fight ' + f(g.dot) + '/s');
    ok(card[2] === Math.round(b.hit) + ' + DoT ' + Math.round(b.dot) + '/s', 'AP ' + ap + ' Creeping Rot card "' + card[2] + '" = fight ' + f(b.hit) + ' + ' + f(b.dot) + '/s');
    ok(card[0] === Math.round(u.hit) + ' AoE', 'AP ' + ap + ' Umbral Cataclysm card "' + card[0] + '" = fight first hit ' + f(u.hit)); }
  R("G.skillLevel.umbris=[1,1,1,1];"); }

console.log('== 8. Lingering Dark (the spread) carries the rot it spread from, buff and all ==');
{ const c = cast('blue', { ap: 100, lv: 10, buff: 1.5 }), { v, F } = c;
  F[1].x = F[0].x + 1.0 * V.METER; F[1].y = F[0].y; F[1].dots.length = 0;   // the spread reaches 2.6 m (centre to centre)
  ok(F[0]._contagion && near(F[0]._plagueDps, c.dot), 'the rotting foe carries the rot at ' + f(F[0]._plagueDps) + '/s');
  F[0].hp = 1; F[0].shield = 0; V.hit(v, F[0], 100, { kind: 'true' }); ok(!F[0].alive, 'the carrier died');
  secs(0.6); const sp = F[1].dots.find(d => d.src === v);
  ok(sp && near(sp.dps, c.dot) && near(sp.dps, 100 * 0.6 * SM(10) * 1.5), 'the spread rot ' + f(sp && sp.dps) + '/s = the rot it came from'); }

console.log('== 9. his basic bolt scales off Attack (as every non-hybrid hero) and a damage buff ==');
{ const bolt = o => { const P = lab('umbris', null, { foes: 1, big: true }), { v, F } = P; v.dmg = o.atk; if (o.buff) { v.dmgBuffT = 99; v.dmgBuffMul = o.buff; }
    v.stunned = 0; v.speed = 0; v.atkCd = 0; v.greenCd = 1e9; v.blueCd = 1e9; v.energy = 0; v.energyReg = 0; v.target = F[0]; v.range = 1e6;
    R(`__who='umbris'; __hits.length=0;`); for (let i = 0; i < 400 && !hits().length; i++) V.step(1); v.stunned = 1e6; return hits()[0] || 0; };
  const a = bolt({ atk: 50 }), b = bolt({ atk: 100 }), c = bolt({ atk: 50, buff: 1.5 });
  ok(a > 0 && near(b, 2 * a) && near(c, 1.5 * a), 'bolt ' + f(a) + ' -> double Attack ' + f(b) + ', +50% buff ' + f(c)); }

console.log('== 10. talent Pulled Apart (15% of his Ability Power a rank) follows his Ability Power and a damage buff ==');
{ const pa = (ap, buff) => { const P = lab('umbris', [['oc_1_4', T.talent('umbris', 'oc_1_4').ranks], ['oc_9_4', T.talent('umbris', 'oc_9_4').ranks]], { foes: 3, big: true }), { v, F } = P;
    v.apow = ap; if (buff) { v.dmgBuffT = 99; v.dmgBuffMul = buff; }
    F[1].x = v.x + 14.5 * V.METER; F[1].y = v.y; F[2].x = v.x + 40 * V.METER; F[2].y = v.y;
    V.cast(v, 'blue', F[0]); const pr = (P.T.s.um.pr || [])[0]; ok(pr && pr.b === F[1], 'Two Stars paired the target with its nearest');
    const h = F[1].hp; F[0].hp = 1; F[0].shield = 0; V.hit(v, F[0], 100, { kind: 'true' }); return h - F[1].hp; };
  const a = pa(100), b = pa(200), c = pa(100, 1.5);
  ok(a > 0 && near(b, 2 * a) && near(c, 1.5 * a), 'Pulled Apart ' + f(a) + ' -> double AP ' + f(b) + ', +50% buff ' + f(c)); }

console.log('== 11. the same rule for Pyroclast\'s Ember Lash (it shares Creeping Rot\'s type); the plain \'dot\' type is unchanged ==');
{ const p0 = cast('green', { key: 'pyroclast', ap: 100, lv: 10 }), p1 = cast('green', { key: 'pyroclast', ap: 100, lv: 10, buff: 1.5 });
  ok(p0.dot > 0 && near(p1.dot, 1.5 * p0.dot) && near(p1.hit, 1.5 * p0.hit), 'Ember Lash: hit ' + f(p0.hit) + ' -> ' + f(p1.hit) + ', burn ' + f(p0.dot) + ' -> ' + f(p1.dot) + '/s with +50%');
  const x0 = cast('blue', { key: 'vex', atk: 100, lv: 10 }), x1 = cast('blue', { key: 'vex', atk: 100, lv: 10, buff: 1.5 });
  ok(R("KITS.vex.blue.type") === 'dot' && x0.dot > 0 && near(x1.dot, x0.dot), 'Vex Bleed Them Dry (type dot): bleed ' + f(x0.dot) + '/s, with +50% buff ' + f(x1.dot) + '/s - unchanged (a question for Phil)'); }

console.log('test_umbris_scaling_1456.js: all ' + pass + ' checks passed');
process.exit(0);
