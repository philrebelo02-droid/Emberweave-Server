// v1456 (Phil 26 Nov 2026: "make sure all of umbris's abilities scale properly"): every damage number Umbris deals, measured in the fight engine
// headless (server/sim-host.js through tests/talents-lab.js - the still field: units held, no rendering). For each one: what it scales off
// (Ability Power for his three skills - he is a Magic hero; Attack for his basic bolt, as every non-hybrid hero), that doubling the stat doubles it,
// that a running damage buff raises it, that the skill level raises it, that hero level / stars / gear Ability Power reach it through his Ability
// Power, and that the number on the skill card is the number the fight deals.
// The fix it guards: Creeping Rot's rot read raw Ability Power x skill level (the plain 'dot' path), so a damage buff never reached it while its own
// hit, Shadeburst's rot and the ultimate all took it. Now apB (as Pyroclast's Ember Lash, which shares the type). The plain 'dot' type (Vex, monsters)
// Also: the Pulled Apart talent (oc_9_4) now reads the buffed Ability Power, as the talent engine's 'apow'. Part 2 (Phil 26 Nov: "yes all dots should
// scale with buffs"): every DoT in the game takes the damage buff its hit takes, as a multiplier, once - sections 12-16.
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

console.log('== 11. the same rule for Pyroclast\'s Ember Lash (it shares Creeping Rot\'s type) and the plain \'dot\' type ==');
{ const p0 = cast('green', { key: 'pyroclast', ap: 100, lv: 10 }), p1 = cast('green', { key: 'pyroclast', ap: 100, lv: 10, buff: 1.5 });
  ok(p0.dot > 0 && near(p1.dot, 1.5 * p0.dot) && near(p1.hit, 1.5 * p0.hit), 'Ember Lash: hit ' + f(p0.hit) + ' -> ' + f(p1.hit) + ', burn ' + f(p0.dot) + ' -> ' + f(p1.dot) + '/s with +50%');
  const x0 = cast('blue', { key: 'vex', atk: 100, lv: 10 }), x1 = cast('blue', { key: 'vex', atk: 100, lv: 10, buff: 1.5 });
  ok(R("KITS.vex.blue.type") === 'dot' && x0.dot > 0 && near(x1.dot, 1.5 * x0.dot), 'Vex Bleed Them Dry (type dot): bleed ' + f(x0.dot) + '/s, with +50% buff ' + f(x1.dot) + '/s (Phil 26 Nov: "yes all dots should scale with buffs")'); }

/* ===== v1456 part 2 (Phil 26 Nov: "yes all dots should scale with buffs" / "50% on a 30% buff shouldnt be 80% it should be 50% of the 30, so 45"):
   every damage-over-time takes the damage buff its hit takes, as a MULTIPLIER of its own number, once. ===== */
// every DoT a unit leaves (its own src) and every ground patch it lays, as numbers
R(`window.__dl=[]; const __pd0=pushDot; pushDot=function(t,dps,dur,iv,c,src){ if(src&&src===window.__dsrc) __dl.push(+dps); return __pd0.apply(this,arguments); };`);
function dotsOf(key, slot, buff) {
  const P = lab(key, null, { foes: 3, big: true }); const { v, F } = P; v.apow = 100; v.dmg = 100; v.skillLv = [10, 10, 10, 10];
  if (buff) { v.dmgBuffT = 99; v.dmgBuffMul = buff; }
  F.forEach((e, i) => { e.dots.length = 0; e.x = v.x + (4 + i * 0.6) * V.METER; e.y = v.y; });
  host.dsrc(v); R('__dl.length=0'); const h0 = R('groundHazards.length');
  try { if (slot === 'ult') { V.cast(v, 'ult', F[0]); v.stunned = 0; v.atkCd = 1e9; v.greenCd = 1e9; v.blueCd = 1e9; v.energy = 0; for (let k = 0; k < 200 && (v._voidCast || v._voidT > 0 || v._voidLandT > 0); k++) V.step(1); v.stunned = 1e6; }
    else V.cast(v, slot, F[0]); } catch (e) { return null; }
  const hz = JSON.parse(R(`JSON.stringify(groundHazards.slice(${h0}).filter(h=>h.src===window.__dsrc&&h.dmg>0).map(h=>h.dmg))`));
  secs(0.6); const out = JSON.parse(R('JSON.stringify(__dl)')).concat(hz); host.dsrc(null); return out; }
const host = { dsrc: u => { NOW.ctx.__u = u; R('window.__dsrc=__u'); } };

console.log('== 12. every hero skill that leaves a DoT or a burning patch: +50% damage buff = exactly x1.5 on every tick (all heroes, green / blue / ultimate) ==');
{ const keys = JSON.parse(R('JSON.stringify(HERO_KEYS.filter(k=>k!==HERO61.KEY))')); let n = 0; const bad = [], seen = [];
  for (const k of keys) for (const s of ['green', 'blue', 'ult']) { const a = dotsOf(k, s), b = a && a.length ? dotsOf(k, s, 1.5) : null; if (!a || !a.length) continue;
    n++; const okk = b && b.length === a.length && a.every((x, i) => near(b[i], 1.5 * x, 1e-9)); seen.push(k + ':' + s); if (!okk) bad.push(k + ':' + s + ' ' + JSON.stringify(a.slice(0, 3)) + ' -> ' + JSON.stringify((b || []).slice(0, 3))); }
  ok(n >= 15 && bad.length === 0, n + ' skills leave a DoT / patch, every one x1.5 with the buff (' + (bad.slice(0, 4).join(' || ') || 'all') + ')');
  for (const want of ['vex:blue', 'pyroclast:green', 'pyroclast:blue', 'grimsby:green', 'dandra:blue', 'carn:blue', 'tolley:blue', 'umbris:green', 'umbris:blue']) ok(seen.includes(want), want + ' is in the sweep'); }

console.log('== 13. the buff MULTIPLIES the DoT\'s own number (0.3/s with +50% = 0.45/s, never 0.3 + 0.5); two buffs never add ==');
{ const g = cast('green', { ap: 100, lv: 1, buff: 1.5 });
  ok(near(g.dot, 100 * 0.3 * 1.5) && !near(g.dot, 100 * (0.3 + 0.5)), 'Shadeburst 0.3 AP/s with +50%: ' + f(g.dot) + '/s = 100 x 0.3 x 1.5 = 45 (not 80)');
  const P = lab('tessit', null, { foes: 1, big: true }); const { v } = P; v.dmgBuffMul = 1.3; v.dmgBuffT = 99;
  const slot = JSON.parse(R(`JSON.stringify(['green','blue'].find(s=>KITS.tessit[s].type==='dmgbuff'))`)), own = R(`skLvNum('dmgbuff',KITS.tessit.${slot},10)`); V.cast(v, slot, P.F[0]); const m1 = v.dmgBuffMul;
  ok(near(m1, own) && !near(m1, 1.3 + own - 1), 'a second damage buff (Tessit\'s x' + f(own) + ') over a running +30% gives x' + f(m1) + ' - the two never add into one number');
  const b3 = cast('green', { ap: 100, lv: 1, buff: m1 });
  ok(near(b3.dot, 100 * 0.3 * m1), 'and the DoT under it is 0.3 x that one buff (' + f(b3.dot) + '/s)');
  const S = R('String(_doEffectCore)'); ok(!/dmgBuffMul\s*\+\s*\(?o\.dps|o\.dps\|\|[^)]*\)\s*\+\s*\(?u\.dmgBuffMul/.test(S), 'no DoT coefficient adds the buff percentage'); }

console.log('== 14. a monster caster\'s DoT takes what its hit takes: the Mage +30%, its magic multiplier and the damage buff ==');
{ const mon = (key, buff) => { const P = lab('vael', null, { foes: 1, big: true }), F = P.F[0];
    NOW.ctx.__k = key; R(`window.__m=makeUnit(__k,'enemy',${P.v.x},${P.v.y},30); units.push(__m); __m.stunned=1e6; __m.maxHp=__m.hp=1e9;`); const m = R('__m');
    if (buff) { m.dmgBuffT = 99; m.dmgBuffMul = buff; } m.target = P.v; P.v.dots.length = 0; host.dsrc(m); R('__dl.length=0');
    const ab = R(`(MONSTER_KITS[__k].green.type==='dot')?MONSTER_KITS[__k].green:MONSTER_KITS[__k].blue`); m._castSlot = 'green'; m._castLv = 1; m._castSM = 1;
    R(`doEffect(__m,'dot',Object.assign({},MONSTER_KITS[__k].green.type==='dot'?MONSTER_KITS[__k].green:MONSTER_KITS[__k].blue,{_arrived:true,_tgtU:__m.target}))`); secs(0.6);
    const d = JSON.parse(R('JSON.stringify(__dl)'))[0] || 0, st = R('monSkillStat(__m)'), ap = m.apMul || 1, dps = ab.dps || 0.5, mage = (m.t.role === 'Mage' || (m.t.role === 'Tank' && R('monScaleMode(__m)') === 'ap')) ? 1.3 : 1;
    host.dsrc(null); R('units.splice(units.indexOf(__m),1)'); return { d, want: st * dps * mage * ap * (buff || 1), mage }; };
  for (const k of ['bitwraith', 'ashen', 'gnashul', 'cinder skulk']) { const a = mon(k), b = mon(k, 1.5);
    ok(a.d > 0 && near(a.d, a.want) && near(b.d, 1.5 * a.d), k + ' (' + (a.mage > 1 ? 'Mage +30%' : 'no caster bonus') + '): DoT ' + f(a.d) + '/s = stat x dps x ' + a.mage + ', +50% buff ' + f(b.d) + '/s'); } }

console.log('== 15. DoTs outside a cast (on-hit passives) take the buff running on their source: Astra Stardust, the ignite proc, Hollow / Kharos bleed stacks ==');
{ const passive = (key, fn, buff) => { const P = lab(key, null, { foes: 1, big: true }), { v, F } = P; v.dmg = 100; if (buff) { v.dmgBuffT = 99; v.dmgBuffMul = buff; }
    F[0].dots.length = 0; host.dsrc(v); R('__dl.length=0'); fn(v, F[0]); const d = JSON.parse(R('JSON.stringify(__dl)')); host.dsrc(null); return d; };
  const star = b => passive('astra', (v, t) => V.hit(v, t, 10, { auto: true }), b);
  const ign = b => passive('vael', (v, t) => { v.pass = Object.assign({}, v.pass, { ignite: true }); V.hit(v, t, 10, { auto: true }); }, b);
  const bl = b => passive('hollow', (v, t) => { NOW.ctx.__v = v; NOW.ctx.__t = t; R('addBleedStack(__v,__t,{bleed:0.16,stackDur:6})'); }, b);
  for (const [n, fn] of [['Stardust', star], ['ignite proc', ign], ['bleed stack', bl]]) { const a = fn(), b = fn(1.5);
    ok(a.length > 0 && a.length === b.length && a.every((x, i) => near(b[i], 1.5 * x)), n + ': ' + JSON.stringify(a.map(f)) + ' -> ' + JSON.stringify(b.map(f))); } }

console.log('== 16. the buff is applied once: a spread rot / a contagion copy carries the buffed number, not the buff again ==');
{ const c = cast('blue', { ap: 100, lv: 10, buff: 1.5 }), { v, F } = c; F[1].x = F[0].x + 1.0 * V.METER; F[1].y = F[0].y; F[1].dots.length = 0;
  F[0].hp = 1; F[0].shield = 0; V.hit(v, F[0], 100, { kind: 'true' }); secs(0.6); const sp = F[1].dots.find(d => d.src === v);
  ok(sp && near(sp.dps, c.dot) && near(sp.dps, 100 * 0.6 * SM(10) * 1.5), 'spread ' + f(sp && sp.dps) + '/s = the source rot (x1.5 once, not x2.25)'); }

console.log('test_umbris_scaling_1456.js: all ' + pass + ' checks passed');
process.exit(0);
