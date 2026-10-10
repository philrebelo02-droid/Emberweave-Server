// v1096 - PERSONAL TEMPLE BLESSINGS (Phil 9 Oct 2026: "each hero gets their own spells in prayer. oakmir as an example maybe can get:
// healing power, health, energy regen, reduced cast time. all heroes should be sort of personalized like this" and "its not class
// specific its hero specific"). Every one of the 60 heroes has its own four rewards (slot k = k x the kind's unit), the class
// template is only the fallback for an unknown key, every reward kind renders as readable text, an earned blessing reaches BOTH the
// server combat unit (applyCore) and the client battle unit built from the server-frozen spec (applyClient) identically, and the
// 5th dot (+15%) raises the blessings only, never the bars (Phil 9 Oct: "it gives 15% of BONUS stats not the attribute stats").
// Asserts (non-zero exit).
'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const T = require('../server/temple-of-ash.js'), FX = require('../server/temple-effects.js'), SIM = require('../server/sim.js');
let pass = 0;
const ok = (c, m) => { assert(c, m); pass++; console.log('  ✓ ' + m); };
const near = (a, b) => Math.abs(a - b) < 1e-6;
const C = T.CONFIG, HB = C.HERO_BLESSINGS, KINDS = C.HERO_BLESSING_KINDS, UNIT = C.BLESSING_UNIT;
const steps = (h, a, m, p) => ({ health: h, attack: a, armorMr: m, pen: p });
const ALL = [true, true, true, true, false], FIVE = [true, true, true, true, true];

/* ---- every hero has its own explicit row ---- */
const keys = fs.readdirSync(path.join(ROOT, 'assets/img/hero-cards')).filter(f => /^card-.*\.webp$/.test(f)).map(f => f.replace(/^card-/, '').replace(/\.webp$/, ''));
ok(keys.length === 60, 'the game has 60 hero cards');
ok(keys.every(k => Array.isArray(HB[k]) && HB[k].length === 4 && HB[k].every(r => Object.keys(r).length === 1)), 'all 60 heroes have their own 4 blessings');
ok(Object.keys(HB).every(k => keys.includes(k)) && keys.every(k => SIM.HERO_BASE[k]), 'control: no row for a hero that does not exist, and every hero is in the sim');
ok(keys.every(k => new Set(KINDS[k]).size === 4), 'no hero repeats a kind across its four slots');
ok(keys.every(k => KINDS[k].every((c, i) => { const u = UNIT[c], r = HB[k][i]; return r[u[0]] != null && near(r[u[0]], u[1] * (i + 1)); })),
  'slot k pays k x the unit of its kind (slot 4 strongest), for every hero');

/* Oakmir is Phil's example, exactly */
ok(JSON.stringify(HB.oakmir.map(r => Object.keys(r)[0])) === JSON.stringify(['heal/shield strength', 'health', 'energy regen', 'cooldown reduction']),
  'Oakmir: healing power / health / energy regen / cooldown reduction (Phil\'s example)');
ok(HB.oakmir[0]['heal/shield strength'] === 0.025 && HB.oakmir[1].health === 640 && HB.oakmir[2]['energy regen'] === 1.5 && HB.oakmir[3]['cooldown reduction'] === 0.08,
  'Oakmir\'s values: +2.5% / +640 / +1.5 / 8%');

/* hero-specific, not class-specific */
{ const ids = keys.map(k => KINDS[k].join()); ok(new Set(ids).size === 60, 'no two heroes share a blessing set');
  let worst = 0, pair = '';
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
    const a = keys[i], b = keys[j]; if (SIM.HERO_BASE[a].role !== SIM.HERO_BASE[b].role) continue;
    const same = KINDS[a].filter((c, n) => c === KINDS[b][n]).length; if (same > worst) { worst = same; pair = a + '/' + b; } }
  ok(worst <= 1, 'class neighbours differ in at least 3 of 4 slots (most alike: ' + pair + ', ' + worst + ' shared slot)'); }

/* ---- labels: every reward kind is readable text in our words ---- */
{ const want = { hp: /^Health \+320$/, atk: /^(Attack damage|Ability power) \+40$/, arm: /^Armor & Magic resist \+220$/, pen: /^Penetration \+105$/,
    heal: /^Healing power \+2\.5%$/, en: /^Energy regen \+0\.5$/, edt: /^Energy from damage taken \+10%$/, cdr: /^Cooldown reduction 2%$/,
    as: /^Attack speed \+2\.5%$/, cc: /^Crit chance \+1\.5%$/, cd: /^Crit damage \+5%$/, ls: /^Lifesteal \+2%$/, dodge: /^Dodge \+1\.2%$/,
    dr: /^Damage reduction \+1\.2%$/, ctrl: /^Control resistance \+3%$/ };
  const bad = Object.keys(UNIT).filter(c => { const r = {}; r[UNIT[c][0]] = UNIT[c][1]; const s = T.blessingLabel(r, c === 'atk' ? 'magic' : 'physical');
    return !(want[c] && want[c].test(s.replace('Attack damage', c === 'atk' ? 'Ability power' : 'Attack damage'))); });
  ok(Object.keys(want).length === Object.keys(UNIT).length && bad.length === 0, 'every reward kind renders as readable text (' + bad.join() + ')');
  ok(T.blessingLabel({ 'energy regen': 2 }, 'magic') === 'Energy regen +2' && T.blessingLabel({ 'heal/shield strength': 0.075 }, 'magic') === 'Healing power +7.5%'
    && T.blessingLabel({ 'cooldown reduction': 0.06 }, 'magic') === 'Cooldown reduction 6%', 'Phil\'s examples: "Energy regen +2", "Healing power +7.5%", "Cooldown reduction 6%"');
  const rows = [].concat.apply([], keys.map(k => HB[k].map(r => T.blessingLabel(r, T.profileOf(SIM.HERO_BASE[k].damageProfile, SIM.HERO_BASE[k].role)))));
  ok(rows.length === 240 && rows.every(s => s && !/undefined|NaN|\//.test(s)), 'all 240 hero blessing labels render cleanly'); }

/* ---- lookup: own row by key; class template only for an unknown key ---- */
ok(JSON.stringify(T.blessingReward('Support', 0, 'oakmir')) === JSON.stringify(HB.oakmir[0]), 'blessingReward reads the hero\'s own row');
ok(JSON.stringify(T.blessingReward('Tank', 3, 'nobody')) === JSON.stringify(C.BLESSINGS.Tank[3]) && JSON.stringify(T.blessingReward('Tank', 3)) === JSON.stringify(C.BLESSINGS.Tank[3]),
  'an unknown or missing key falls back to the class template');
{ const b = T.heroBonuses({ steps: steps(0, 0, 0, 0), boonsUnlocked: [true, false, false, false, false] }, 'Tank', 'Attack', 'nobody');
  ok(b.hpFlat === 700, 'fallback: an unknown key earns the Tank template\'s Health +700'); }
{ const st = T.newState(); st.playerLevel = 100; st.heroes.oakmir = { steps: steps(0, 0, 0, 0), boonsUnlocked: ALL.slice() };
  T.migrateState(st);
  ok(st.heroes.oakmir.key === 'oakmir', 'the server state carries the hero key (stamped once by migrateState)');
  const viaStamp = T.heroBonuses(st.heroes.oakmir, 'Support', 'Healer'), viaKey = T.heroBonuses({ steps: steps(0, 0, 0, 0), boonsUnlocked: ALL.slice() }, 'Support', 'Healer', 'oakmir');
  ok(JSON.stringify(viaStamp) === JSON.stringify(viaKey) && viaKey.hpFlat === 640 && viaKey['energy regen'] === 1.5, 'the stamped key and an explicit key give the same bonuses');
  const json = JSON.parse(JSON.stringify(st.heroes.oakmir));
  ok(JSON.stringify(T.heroBonuses(json, 'Support', 'Healer')) === JSON.stringify(viaKey), 'the key survives the trip to the client (JSON), so templeBonusesClient gets the same set');
  globalThis.G = { temple: { heroes: { lumi: { steps: steps(0, 0, 0, 0), boonsUnlocked: ALL.slice() } } } };
  ok(near(T.heroBonuses(G.temple.heroes.lumi, 'Support', 'Healer')['energy regen'], 2), 'browser: an unstamped hero state is found in G.temple.heroes by identity');
  delete globalThis.G;
  const s = T.heroTempleStats(st, 'oakmir', { role: 'Support', damageProfile: 'Healer', heroLevel: 100 });
  ok(s.blessings.map(r => r.label).join(' | ') === 'Healing power +2.5% | Health +640 | Energy regen +1.5 | Cooldown reduction 8%', 'the Temple panel rows show Oakmir\'s own labels');
  ok(s.fifth.label === '5th dot: blessings +15%' && s.fifth.bonus === 0.15, 'the 5th dot reads "5th dot: blessings +15%"'); }

/* ---- the 5th dot: blessings x1.15, the bars untouched ---- */
ok(C.FIFTH_ORB_BONUS === 0.15, 'FIFTH_ORB_BONUS is 0.15 (Phil 9 Oct: "make 5th dot 15% not 10")');
{ const bar = T.heroBonuses({ steps: steps(200, 0, 0, 0), boonsUnlocked: [false, false, false, false, true] }, 'Bruiser', 'Attack', 'carn');
  ok(bar.hpFlat === 7000, 'a 200-step Health bar stays +7,000 with the 5th dot (bars are not bonus stats)');
  const tank = T.heroBonuses({ steps: steps(0, 0, 0, 0), boonsUnlocked: [true, false, false, false, true] }, 'Tank', 'Attack', 'nobody');
  ok(tank.hpFlat === 805, 'an earned Health +700 blessing becomes 805 with the 5th dot');
  const st = steps(37, 81, 140, 190);
  const no5 = T.heroBonuses({ steps: st, boonsUnlocked: [false, false, false, false, false] }, 'Mage', 'Magic', 'astra');
  const w5 = T.heroBonuses({ steps: st, boonsUnlocked: [false, false, false, false, true] }, 'Mage', 'Magic', 'astra');
  ok(JSON.stringify(no5) === JSON.stringify(w5) && no5.hpFlat > 0, 'control: steps and no blessings give the same totals with or without the 5th dot');
  const lit = T.heroBonuses({ steps: st, boonsUnlocked: ALL.slice() }, 'Mage', 'Magic', 'astra'), lit5 = T.heroBonuses({ steps: st, boonsUnlocked: FIVE.slice() }, 'Mage', 'Magic', 'astra');
  /* v1098: Astra's own bars are Health / Ability power / Attack speed / Magic penetration, so her 140-step Attack speed bar is in
     no5 too - the blessing part is the difference */
  ok(lit5.hpFlat === no5.hpFlat && lit5.apFlat === no5.apFlat + Math.round(160 * 1.15) && (lit5.armorPenFlat || 0) === (no5.armorPenFlat || 0) + Math.round(315 * 1.15)
    && near(lit5['energy regen'] - (no5['energy regen'] || 0), 0.575) && near(lit5['attack speed'] - no5['attack speed'], 0.0575) && near(lit['attack speed'] - no5['attack speed'], 0.05)
    && near(no5['attack speed'], 140 * 0.00075), 'Astra with the 5th dot: her blessings x1.15, her bars (140-step Attack speed = +10.5%) as they were'); }

/* ---- an earned blessing changes the battle unit: server applyCore vs client applyClient, identically ---- */
const host = require('../server/sim-host.js').load(path.join(ROOT, 'emberweave-heroes.html'));
const OPT = { level: 100, stars: 5, pips: 0, ref: 0 };
function coreUnit(key, b) { const R = {}, X = {}; FX.coreRatings(R, X, b); return FX.applyCore(SIM.heroCombatStats(key, Object.assign({}, OPT, { ratings: R, extra: X })), b); }
function clientUnit(key, b) { return host.snapFromSpecs([{ key: key, level: 100, stars: 5, pips: 0, ref: 0, glyphRank: 6, tt: {}, ex: {}, fAtk: 0, fHp: 0, fApow: 0, apMul: 1, skillLv: [1, 1, 1, 1], templeBonuses: b }])[0]; }
function deltas(s0, s1, c0, c1) {
  const r = (a, b) => (a ? b / a : 1);
  return {
    hp: [s1.maxHp - s0.maxHp, c1.maxHp - c0.maxHp], ad: [s1.atkP - s0.atkP, c1.dmg - c0.dmg], ap: [s1.atkM - s0.atkM, c1.apow - c0.apow],
    armor: [s1.armor - s0.armor, c1.armorRating - c0.armorRating], mr: [s1.mr - s0.mr, c1.mrRating - c0.mrRating],
    aPen: [s1.armorPen - s0.armorPen, c1.armorPen - c0.armorPen], mPen: [s1.magicPen - s0.magicPen, c1.magicPen - c0.magicPen],
    shield: [r(s0.shieldStr, s1.shieldStr), r(c0.shieldStrMul || 1, c1.shieldStrMul || 1)],
    energyReg: [(s1.energyReg || 0) - (s0.energyReg || 0), (c1.energyReg || 0) - (c0.energyReg || 0)],
    dmgEnergy: [s1.templeDamageEnergy || 0, c1.templeDamageEnergy || 0],
    haste: [r(s0.haste, s1.haste), r(c0.hasteEnergyMul || 1, c1.hasteEnergyMul || 1)],
    atkSpeed: [r(s0.speed, s1.speed), r(1 / c0.atkInterval, 1 / c1.atkInterval)],
    crit: [s1.crit - s0.crit, c1.glyphCrit - c0.glyphCrit], critDmg: [s1.critDmg - s0.critDmg, c1.critDmg - c0.critDmg],
    lifesteal: [s1.lifesteal - s0.lifesteal, (c1.lifestealStat || 0) - (c0.lifestealStat || 0)], dr: [s1.dmgRed - s0.dmgRed, (c1.glyphDR || 0) - (c0.glyphDR || 0)],
    dodge: [s1.eva - s0.eva, (c1.evaStat || 0) - (c0.evaStat || 0)], ctrl: [s1.ctrlRes - s0.ctrlRes, (c1.ctrlRes || 0) - (c0.ctrlRes || 0)],
  };
}
const EXPECT = { 'health': ['hp'], 'attack': ['ad', 'ap'], 'armorMr': ['armor', 'mr'], 'pen': ['aPen', 'mPen'], 'heal/shield strength': ['shield'], 'energy regen': ['energyReg'],
  'energy from damage taken': ['dmgEnergy'], 'cooldown reduction': ['haste'], 'attack speed': ['atkSpeed'], 'crit chance': ['crit'], 'crit damage': ['critDmg'],
  'lifesteal': ['lifesteal'], 'damage reduction': ['dr'], 'dodge': ['dodge'], 'control resistance': ['ctrl'] };
{ const kindsSeen = new Set(), mismatch = [], dead = [];
  for (const key of keys) {
    const base = SIM.HERO_BASE[key], none = T.heroBonuses({ steps: steps(0, 0, 0, 0), boonsUnlocked: [false, false, false, false, false] }, base.role, base.damageProfile, key);
    const all = T.heroBonuses({ steps: steps(0, 0, 0, 0), boonsUnlocked: ALL.slice() }, base.role, base.damageProfile, key);
    const d = deltas(coreUnit(key, none), coreUnit(key, all), clientUnit(key, none), clientUnit(key, all));
    for (const f of Object.keys(d)) if (!near(d[f][0], d[f][1])) mismatch.push(key + '.' + f + ' ' + d[f][0] + ' vs ' + d[f][1]);
    for (const r of HB[key]) { const k = Object.keys(r)[0]; kindsSeen.add(k);
      if (!EXPECT[k].some(f => d[f] && (f === 'shield' || f === 'haste' || f === 'atkSpeed' ? d[f][0] > 1 + 1e-9 : Math.abs(d[f][0]) > 1e-9))) dead.push(key + ':' + k); }
  }
  ok(mismatch.length === 0, 'all 60 heroes: four earned blessings move the server unit and the client unit by the same amounts' + (mismatch.length ? ' ' + mismatch.slice(0, 5).join('; ') : ''));
  ok(dead.length === 0, 'every earned blessing actually changes its hero\'s battle unit (' + (dead.slice(0, 5).join() || 'none dead') + ')');
  ok(kindsSeen.size === Object.keys(EXPECT).length, 'control: the 60 heroes use all ' + kindsSeen.size + ' reward kinds, so every adapter path was exercised'); }
{ const b = T.heroBonuses({ steps: steps(0, 0, 0, 0), boonsUnlocked: ALL.slice() }, 'Support', 'Healer', 'oakmir');
  const s0 = SIM.heroCombatStats('oakmir', OPT), s1 = coreUnit('oakmir', b);
  ok(s1.maxHp === s0.maxHp + 640 && near(s1.heal / s0.heal, 1.025) && near(s1.energyReg - (s0.energyReg || 0), 1.5) && near(s1.haste / s0.haste, 1.08),
    'Oakmir\'s server unit: +640 health, heals x1.025, +1.5 energy regen, energy haste x1.08'); }

/* ---- rough power check: no hero's set is far above another's on the card ---- */
{ const m = keys.map(k => { const b = SIM.HERO_BASE[k]; const bon = T.heroBonuses({ steps: steps(0, 0, 0, 0), boonsUnlocked: ALL.slice() }, b.role, b.damageProfile, k);
    const fx = {}; Object.keys(bon).forEach(x => { if (FX.FLAT_KEYS.indexOf(x) < 0) fx[x] = bon[x]; }); return FX.powerMultiplier(fx); });
  const lo = Math.min.apply(null, m), hi = Math.max.apply(null, m);
  ok(hi <= 1.10 && lo >= 1, 'no hero\'s % blessings add more than +10% to its card multiplier (' + lo.toFixed(4) + ' - ' + hi.toFixed(4) + '); every set is 1+2+3+4 = 10 units'); }

console.log('test_temple_blessings_1096.js: ' + pass + ' checks passed, 0 failed');
