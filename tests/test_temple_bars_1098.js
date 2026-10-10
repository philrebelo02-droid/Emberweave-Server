// v1098 - HERO-SPECIFIC TEMPLE BARS (Phil 9 Oct 2026, on Oakmir's screen showing Health / Ability power / Armor & Magic resist /
// Magic penetration: "how does magic penetration ... help oakmir" and "all bars should be heroes specific").
// Every one of the 60 heroes prays on ITS OWN four bars (TEMPLE_CONFIG.HERO_BARS), bar 1 its survival stat; each bar kind has its own
// step size (flats keep the v1094 steps, % kinds PROPOSED); Power stays 10 x net steps; blessing thresholds sit on bar SLOTS 1-4;
// the v1096 storage (health / attack / armorMr / pen) moves positionally onto the hero's own bars, once, keeping steps and dots;
// and the same bars build the same battle unit on the server (coreRatings + applyCore) and the client (clientFlats + applyClient)
// for all 60 heroes. Control: a client path that drops one kind must make the parity check fail.
// Asserts (non-zero exit).
'use strict';
const assert = require('assert'), fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const T = require('../server/temple-of-ash.js'), FX = require('../server/temple-effects.js'), SIM = require('../server/sim.js');
let pass = 0;
const ok = (c, m) => { assert(c, m); pass++; console.log('  ✓ ' + m); };
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-6);
const C = T.CONFIG, HB = C.HERO_BARS, K = C.BAR_KINDS;
const keys = fs.readdirSync(path.join(ROOT, 'assets/img/hero-cards')).filter(f => /^card-.*\.webp$/.test(f)).map(f => f.replace(/^card-/, '').replace(/\.webp$/, ''));
const prof = k => SIM.HERO_BASE[k].damageProfile;
const NONE = [false, false, false, false, false], ALL = [true, true, true, true, false];

/* ---- every hero has its own explicit row of four ---- */
ok(keys.length === 60 && keys.every(k => Array.isArray(HB[k]) && HB[k].length === 4), 'all 60 heroes have their own row of 4 bars');
ok(Object.keys(HB).every(k => keys.includes(k)), 'control: no row for a hero that does not exist');
ok(keys.every(k => HB[k].every(b => K[b]) && new Set(HB[k]).size === 4), 'every bar is a known kind and no hero repeats a kind');
ok(new Set(keys.map(k => HB[k].slice().sort().join())).size === 60, 'no two heroes share the same four bars');
ok(keys.every(k => ['health', 'dodge', 'lifesteal'].includes(HB[k][0])) && keys.filter(k => HB[k][0] === 'health').length >= 50,
  'bar 1 is the survival stat (Health for ' + keys.filter(k => HB[k][0] === 'health').length + ' heroes, Dodge / Lifesteal for the evasive and the drainers)');
ok(JSON.stringify(HB.oakmir) === JSON.stringify(['health', 'healPow', 'abilityPower', 'energyRegen']), 'Oakmir: Health / Healing power / Ability power / Energy regen');
{ const PEN = ['pen', 'armorPen', 'magicPen'];
  const healers = keys.filter(k => prof(k) === 'Healer' && HB[k].some(b => PEN.includes(b)));
  ok(!HB.oakmir.some(b => PEN.includes(b)) && healers.join() === 'mellan', 'no penetration on a healer except Mellan (Hornet Cloud is real poison damage): ' + healers.join());
  const physAp = keys.filter(k => prof(k) === 'Attack' && HB[k].includes('abilityPower')), magAd = keys.filter(k => ['Magic', 'Healer'].includes(prof(k)) && HB[k].includes('attack'));
  ok(!physAp.length && !magAd.length, 'no Ability power bar on an Attack hero and no Attack damage bar on a Magic / Healer hero (' + physAp.concat(magAd).join() + ')'); }
{ const used = new Set([].concat.apply([], keys.map(k => HB[k])));
  ok(['health', 'attack', 'abilityPower', 'armorMr', 'armor', 'magicResist', 'armorPen', 'magicPen', 'healPow', 'energyRegen', 'cooldown', 'attackSpeed', 'critChance', 'critDamage', 'lifesteal', 'dodge', 'damageReduction', 'ctrlRes'].every(b => used.has(b)),
    'the 60 rows use ' + used.size + ' bar kinds, every adapter path included'); }

/* ---- step size per kind: flats keep the v1094 steps, % kinds as PROPOSED; a full 200-step bar ---- */
{ const full = (b, p) => T.barValue(p || 'Attack', b, 200);
  ok(full('health') === 7000 && full('health', 'Magic') === 5000 && full('attack') === 480 && full('abilityPower', 'Magic') === 640 && full('armorMr') === 1440 && full('armorMr', 'Magic') === 960
    && full('pen') === 960 && full('pen', 'Magic') === 1440, 'flats keep their v1094 steps (Health 35/25, Attack damage 2.4, Ability power 3.2, Armor & MR 7.2/4.8, Penetration 4.8/7.2)');
  const want = { healPow: 0.2, attackSpeed: 0.15, critChance: 0.06, critDamage: 0.3, lifesteal: 0.08, dodge: 0.06, damageReduction: 0.06, energyRegen: 2, cooldown: 0.1, ctrlRes: 0.15 };
  ok(Object.keys(want).every(b => near(full(b), want[b])), 'a full bar: Healing power 20%, Attack speed 15%, Crit chance 6%, Crit damage 30%, Lifesteal 8%, Dodge 6%, Damage reduction 6%, Energy regen 2, Cooldown 10%, Control resistance 15%');
  ok(T.barText('healPow', 0.033) === '3.3%' && T.barText('energyRegen', 0.21) === '0.21' && T.barText('health', 7000) === '7,000' && T.barText('critDamage', 0.0045, true) === '+0.45%' && T.barText('attack', -4.8, true) === '-4.8',
    'values read as numbers or %: "3.3%", "0.21", "7,000", "+0.45%", "-4.8"'); }

/* ---- every bar kind has its icon on disk ---- */
{ const missing = [];
  for (const b of Object.keys(K)) for (const p of ['Attack', 'Magic']) { const f = path.join(ROOT, 'assets/img/icons/stat', T.barIcon(b, p) + '-v1.webp'); if (!fs.existsSync(f)) missing.push(b + ':' + T.barIcon(b, p)); }
  ok(missing.length === 0, 'every bar kind\'s icon is on disk (' + (missing.join() || 'none missing') + ')'); }

/* ---- a prayer rolls the hero's own four; Power = 10 x net steps whatever the kinds ---- */
{ const st = T.newState(); st.playerLevel = 100; let i = 0; const R = [0.0, 0.999, 0.99]; T.setRng(() => (i < 3 ? R[i++] : ((i++ % 2) ? 0.99 : 0.0)));   // gain, 30 steps, no breakout   // v1098 two rolls: a gain of 30, dealt to the open bars
  const s = T.pray(st, 'oakmir', 'gold', { profile: 'Healer' });
  ok(Object.keys(s.rolls).join() === HB.oakmir.join() && s.bars.join() === HB.oakmir.join(), 'Oakmir prayer rolls Health / Healing power / Ability power / Energy regen');
  ok(s.power === 10 * s.net && s.net === 3, 'Power = 10 x net steps, not the values ('+s.net+' steps = '+s.power+')');
  ok(s.rolls.abilityPower.deltaSteps === 0 && s.rolls.energyRegen.deltaSteps === 0, 'at Temple 1 bars 3 and 4 (Temple 7 / 11) cannot move');
  ok(near(s.rolls.healPow.toValue, s.rolls.healPow.toSteps * 0.001, 1e-9) && s.rolls.health.toValue === s.rolls.health.toSteps * 25, 'each roll carries its own kind value (Healing power 0.1% a step, Health 25 a step)');
  T.saveSession(st);
  ok(st.heroes.oakmir.steps.health === s.rolls.health.toSteps && st.heroes.oakmir.steps.healPow === s.rolls.healPow.toSteps && st.heroes.oakmir.bars.join() === HB.oakmir.join(), 'Save stores the steps by kind with the layout'); }

/* ---- blessing thresholds sit on bar slots 1-4 (v1102: 35 / 70 / 130 / 190) ---- */
ok(C.BLESSING_NEEDS.map(n => n.slot + ':' + n.need).join() === '0:35,1:70,2:130,3:190', 'BLESSING_NEEDS names bar slots 1-4 at 35 / 70 / 130 / 190 steps (v1102 Phil)');
{ const st = T.newState(); st.playerLevel = 100; st.keeperPoints = 1e7;
  const at = (a, b, c, d) => ({ key: 'rafe', bars: HB.rafe.slice(), steps: { dodge: a, attackSpeed: b, critChance: c, critDamage: d }, boonsUnlocked: NONE.slice() });
  const rows = T.blessingsFor(st, at(35, 70, 130, 190), { role: 'Marksman', damageProfile: 'Attack', heroLevel: 100, key: 'rafe' });
  ok(rows.every(r => r.canUnlock) && rows.map(r => r.barName).join() === 'Dodge,Attack speed,Crit chance,Crit damage', 'Rafe: the dots read his own bars (Dodge 35 / Attack speed 70 / Crit chance 130 / Crit damage 190)');
  ok(T.blessingsFor(st, at(19, 49, 129, 189), { role: 'Marksman', damageProfile: 'Attack', heroLevel: 100, key: 'rafe' }).every(r => !r.canUnlock), 'control: one step short on every slot earns nothing');
  const s = T.heroTempleStats(Object.assign(st, { heroes: { oakmir: { key: 'oakmir', bars: HB.oakmir.slice(), steps: { health: 25, healPow: 10, abilityPower: 0, energyRegen: 0 }, boonsUnlocked: NONE.slice() } } }), 'oakmir', { role: 'Support', damageProfile: 'Healer', heroLevel: 100 });
  ok(s.bars.map(b => b.name + ' ' + b.icon + ' ' + b.text).join(' | ') === 'Health hp 625 | Healing power healPow 1% | Ability power apow 0 | Energy regen energy 0',
    'the panel bars: own name, own icon, value as number or % (' + s.bars.map(b => b.name + ' ' + b.text).join(', ') + ')');
  ok(s.blessings[0].barName === 'Health' && s.blessings[1].barName === 'Healing power' && s.blessings[1].have === 10 && s.blessings[1].canUnlock === false, 'blessing 2 waits on Oakmir\'s Healing power bar (10 / 50)'); }

/* ---- migration: v1096 {health, attack, armorMr, pen} -> the hero's own bars, positionally; once; dots kept ---- */
{ const st = T.newState(); st.playerLevel = 100; st.keeperPoints = 1e7;
  st.heroes.oakmir = { steps: { health: 30, attack: 33, armorMr: 27, pen: 21 }, boonsUnlocked: [true, true, false, false, false] };
  st.heroes.vael = { key: 'vael', steps: { health: 200, attack: 190, armorMr: 0, pen: 7 }, boonsUnlocked: [true, true, true, true, true] };
  st._pending = { v2: true, heroId: 'oakmir', tier: 'gold', profile: 'magic', net: 1, power: 10,
    rolls: { health: { fromSteps: 30, deltaSteps: 1, toSteps: 31 }, attack: { fromSteps: 33, deltaSteps: 0, toSteps: 33 }, armorMr: { fromSteps: 27, deltaSteps: 0, toSteps: 27 }, pen: { fromSteps: 21, deltaSteps: 0, toSteps: 21 } } };
  T.migrateState(st);
  ok(JSON.stringify(st.heroes.oakmir.steps) === '{"health":30,"healPow":33,"abilityPower":27,"energyRegen":21}' && st.heroes.oakmir.bars.join() === HB.oakmir.join(),
    'Oakmir: old bar i -> new bar i with its step count (Health 30, Healing power 33, Ability power 27, Energy regen 21)');
  ok(JSON.stringify(st.heroes.vael.steps) === '{"health":200,"critChance":190,"attackSpeed":0,"lifesteal":7}', 'Vael: the same positional move onto Health / Crit chance / Attack speed / Lifesteal');
  ok(st.heroes.oakmir.boonsUnlocked.slice(0, 2).every(Boolean) && st.heroes.vael.boonsUnlocked.every(Boolean), 'earned dots stay earned');
  ok(Object.keys(st._pending.rolls).join() === HB.oakmir.join() && st._pending.rolls.healPow.toSteps === 33 && near(st._pending.rolls.healPow.toValue, 0.033), 'a pending v1096 prayer moves onto the same bars (kept, it was paid)');
  const once = JSON.stringify(st); T.migrateState(st); T.migrateState(st);
  ok(JSON.stringify(st) === once, 'the migration is idempotent (two more runs change nothing)');
  T.saveSession(st);
  ok(st.heroes.oakmir.steps.health === 31 && st.heroes.oakmir.steps.healPow === 33, 'saving the moved pending prayer applies to the new bars');
  const legacy = { steps: { health: 30, attack: 33, armorMr: 27, pen: 21 }, boonsUnlocked: NONE.slice() };
  ok(JSON.stringify(T.heroBonuses(legacy, 'Support', 'Healer', 'oakmir')) === JSON.stringify(T.heroBonuses({ key: 'oakmir', bars: HB.oakmir.slice(), steps: { health: 30, healPow: 33, abilityPower: 27, energyRegen: 21 }, boonsUnlocked: NONE.slice() }, 'Support', 'Healer')),
    'an unmigrated state reads the same bonuses as the migrated one (alignSteps = the migration rule)'); }

/* ---- battle: all 60 heroes, server unit (coreRatings + applyCore) vs client unit (clientFlats + applyClient), identically ---- */
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
    heal: [r(s0.shieldStr, s1.shieldStr), r(c0.shieldStrMul || 1, c1.shieldStrMul || 1)],
    energyReg: [(s1.energyReg || 0) - (s0.energyReg || 0), (c1.energyReg || 0) - (c0.energyReg || 0)],
    haste: [r(s0.haste, s1.haste), r(c0.hasteEnergyMul || 1, c1.hasteEnergyMul || 1)],
    atkSpeed: [r(s0.speed, s1.speed), r(1 / c0.atkInterval, 1 / c1.atkInterval)],
    crit: [s1.crit - s0.crit, c1.glyphCrit - c0.glyphCrit], critDmg: [s1.critDmg - s0.critDmg, c1.critDmg - c0.critDmg],
    lifesteal: [s1.lifesteal - s0.lifesteal, (c1.lifestealStat || 0) - (c0.lifestealStat || 0)], dr: [s1.dmgRed - s0.dmgRed, (c1.glyphDR || 0) - (c0.glyphDR || 0)],
    dodge: [s1.eva - s0.eva, (c1.evaStat || 0) - (c0.evaStat || 0)], ctrl: [s1.ctrlRes - s0.ctrlRes, (c1.ctrlRes || 0) - (c0.ctrlRes || 0)],
  };
}
const MOVES = { health: ['hp'], attack: ['ad'], abilityPower: ['ap'], armorMr: ['armor', 'mr'], armor: ['armor'], magicResist: ['mr'], pen: ['aPen', 'mPen'], armorPen: ['aPen'], magicPen: ['mPen'],
  healPow: ['heal'], energyRegen: ['energyReg'], cooldown: ['haste'], attackSpeed: ['atkSpeed'], critChance: ['crit'], critDamage: ['critDmg'], lifesteal: ['lifesteal'], dodge: ['dodge'],
  damageReduction: ['dr'], ctrlRes: ['ctrl'] };
const RATIO = { heal: 1, haste: 1, atkSpeed: 1 };
function sweep(steps, lit) {
  const mismatch = [], dead = [];
  for (const key of keys) {
    const base = SIM.HERO_BASE[key], st = {}; HB[key].forEach(b => { st[b] = steps; });
    const h = { key: key, bars: HB[key].slice(), steps: st, boonsUnlocked: lit.slice() };
    const none = T.heroBonuses({ key: key, bars: HB[key].slice(), steps: {}, boonsUnlocked: NONE.slice() }, base.role, base.damageProfile, key), full = T.heroBonuses(h, base.role, base.damageProfile, key);
    const d = deltas(coreUnit(key, none), coreUnit(key, full), clientUnit(key, none), clientUnit(key, full));
    for (const f of Object.keys(d)) if (!near(d[f][0], d[f][1])) mismatch.push(key + '.' + f + ' ' + d[f][0] + ' vs ' + d[f][1]);
    for (const b of HB[key]) if (!MOVES[b].some(f => RATIO[f] ? d[f][0] > 1 + 1e-9 : Math.abs(d[f][0]) > 1e-9)) dead.push(key + ':' + b);
  }
  return { mismatch, dead };
}
{ const r = sweep(200, NONE);
  ok(r.mismatch.length === 0, 'all 60 heroes, four full bars: the server unit and the client unit move by the same amounts' + (r.mismatch.length ? ' ' + r.mismatch.slice(0, 5).join('; ') : ''));
  ok(r.dead.length === 0, 'every one of the 240 bars changes its hero\'s battle unit (' + (r.dead.slice(0, 5).join() || 'none dead') + ')');
  const r2 = sweep(37, ALL);
  ok(r2.mismatch.length === 0, 'all 60 heroes, 37-step bars + four earned blessings (bar and blessing of one kind summed): server = client' + (r2.mismatch.length ? ' ' + r2.mismatch.slice(0, 5).join('; ') : '')); }
{ const b = T.heroBonuses({ key: 'oakmir', bars: HB.oakmir.slice(), steps: { health: 200, healPow: 200, abilityPower: 200, energyRegen: 200 }, boonsUnlocked: NONE.slice() }, 'Support', 'Healer', 'oakmir');
  const s0 = SIM.heroCombatStats('oakmir', OPT), s1 = coreUnit('oakmir', b), noHeal = Object.assign({}, b); delete noHeal['heal/shield strength'];
  ok(s1.maxHp === s0.maxHp + 5000 && near(s1.heal / coreUnit('oakmir', noHeal).heal, 1.2) && near(s1.energyReg - (s0.energyReg || 0), 2) && s1.atkM > s0.atkM && !b.magicPenFlat && !b.armorPenFlat,
    'Oakmir full: +5,000 health, heals x1.2, +2 energy regen, more Ability power - and no penetration'); }

/* ---- control: a client path that drops one kind (Crit damage) must fail the parity sweep ---- */
{ const CFX = vm.runInContext('TempleEffects', host.ctx), real = CFX.applyClient;
  CFX.applyClient = function (u, b) { const c = Object.assign({}, b); delete c['crit damage']; return real(u, c); };
  let r; try { r = sweep(200, NONE); } finally { CFX.applyClient = real; }
  const hit = r.mismatch.filter(m => /\.critDmg /.test(m)).map(m => m.split('.')[0]), want = keys.filter(k => HB[k].includes('critDamage'));
  ok(want.length > 0 && hit.sort().join() === want.sort().join(), 'control: a client that drops Crit damage fails the sweep for exactly the ' + want.length + ' Crit damage heroes (' + hit.join() + ')');
  ok(sweep(200, NONE).mismatch.length === 0, 'control restored: the sweep passes again'); }

/* ---- card power: % bars count in the card multiplier on both sides (same function), flats in the unit ---- */
{ const b = T.heroBonuses({ key: 'rafe', bars: HB.rafe.slice(), steps: { dodge: 200, attackSpeed: 200, critChance: 200, critDamage: 200 }, boonsUnlocked: NONE.slice() }, 'Marksman', 'Attack', 'rafe');
  ok(near(FX.powerMultiplier(b), 1 + (0.06 + 0.15 + 0.06 + 0.3) / 4), 'Rafe\'s four full % bars raise his card multiplier by their sum / 4 (' + FX.powerMultiplier(b).toFixed(4) + ')'); }

/* ---- the page loads this build's modules (phones kept the v1094-tagged module after v1096) ---- */
{ const page = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8');
  ok(/<script src="\/server\/temple-of-ash\.js\?v=r1102"><\/script>/.test(page) && /<script src="\/server\/temple-effects\.js\?v=r1098"><\/script>/.test(page), 'the page asks for temple-of-ash.js at ?v=r1102 (v1102 blessing numbers) and temple-effects.js at ?v=r1098');
  const fn = page.slice(page.indexOf('function renderTemple(){'), page.indexOf('function startDungeon(){'));
  ok(/hs\.bars\.map\(/.test(fn) && /\$\{B\.icon\}-v1\.webp/.test(fn) && /escapeHTML\(B\.name\)/.test(fn) && /T\.barText\(bar,val\)/.test(fn) && !/TP2_BARS|tp2BarLabel/.test(fn),
    'renderTemple draws the hero\'s own bars: name, icon, value as number or %');
  ok(/x\.barName\|\|T\.barName\(x\.bar\)/.test(fn), 'blessing rows say "(<bar name> n/need to unlock)" with the bar\'s real name');
  ok(/TempleOfAsh\.heroBonuses\(h,t\.role,t\.damageProfile,key\)/.test(page), 'the client passes the hero key, as the server does'); }

console.log('test_temple_bars_1098.js: ' + pass + ' checks passed, 0 failed');
