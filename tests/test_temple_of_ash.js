// test_temple_of_ash.js - every ruling in server/temple-of-ash.js, checked. v1094: rewritten for TEMPLE OF ASH v2 (the reference's
// prayer copied, 9 Oct 2026) - four flat bars in steps, cap by Temple level, measured roll tables, blessings at step thresholds.
// Run: node tests/test_temple_of_ash.js [path/to/temple-of-ash.js]
const path = require('path');
const T = require(path.resolve(process.argv[2] || path.join(__dirname, '..', 'server', 'temple-of-ash.js')));
let ok = 0, bad = 0;
const ck = (name, cond) => { if (cond) ok++; else { bad++; console.log('FAIL', name); } };
const near = (a, b, e) => Math.abs(a - b) <= e;
const seq = vals => { let i = 0; return () => vals[i++ % vals.length]; };
const BARS = ['health', 'attack', 'armorMr', 'pen'];
const pts = lv => { let s = 0; for (let i = 0; i < lv; i++) s += T.FLAMEKEEPER_TRACK[i].exp; return s; };
const hero = (h, a, m, p, lit) => ({ steps: { health: h, attack: a, armorMr: m, pen: p }, boonsUnlocked: lit || [false, false, false, false, false] });

// tiers unlock at temple 2/7/14/17 (our names)
ck('tiers at T6', T.tiersOpen(6).map(t => t.id).join() === 'gold,kindled');
ck('tiers at T17', T.tiersOpen(17).map(t => t.id).join() === 'gold,kindled,stoked,blazing,inferno');
{ const st = T.newState(); st.heroes = { h: hero(0, 0, 0, 0) }; st.playerLevel = 85;
  ck('control: a locked tier is refused', T.pray(st, 'h', 'inferno').ok === false); }

// keeper track: per-level exp (the reference's "Lv 19 2747/6500"), player gates follow the dots
{ const p = T.keeperProgress(pts(19) + 2747, 85); ck('keeper bar 19 / 2747 / 6500', p.level === 19 && p.into === 2747 && p.need === 6500); }
ck('player gates 50->12, 60->18, 70->24, 80->40, 90->50', [[50, 12], [60, 18], [70, 24], [80, 40], [90, 50]].every(([pl, t]) => T.keeperLevel(1e9, pl) === t));

// four fixed bars, all roll from Temple 1; cap by Temple level
ck('four bars open at Temple 1', T.barsOpen(1).join() === BARS.join());
ck('cap 40/75/110/140/170/200', [1, 5, 9, 13, 16, 19].map(T.capSteps).join() === '40,75,110,140,170,200');
{ const st = T.newState(); st.heroes = { h: hero(0, 0, 0, 0) }; st.playerLevel = 50; T.setRng(seq([0.3]));
  const s = T.pray(st, 'h', 'gold'); ck('a Temple-1 prayer rolls all four bars', Object.keys(s.rolls).join() === BARS.join()); T.discardSession(st); }

// a roll comes from the tier's measured table; power = 10 x net applied steps
{ const st = T.newState(); st.heroes = { h: hero(10, 10, 10, 10) }; st.playerLevel = 50; T.setRng(seq([0.999]));   // top of every table
  const s = T.pray(st, 'h', 'gold', { profile: 'Attack' });
  ck('the Gold ritual top roll is +3 on every bar', BARS.every(b => s.rolls[b].deltaSteps === 3));
  ck('power = 10 x net steps', s.power === 120 && s.net === 12);
  ck('values are steps x the physical step', s.rolls.health.toValue === 13 * 35 && near(s.rolls.attack.deltaValue, 3 * 2.4, 1e-9)); T.discardSession(st); }
{ const st = T.newState(); st.heroes = { h: hero(0, 0, 0, 0) }; st.playerLevel = 50; T.setRng(seq([0.0]));   // bottom of the Gold table
  const s = T.pray(st, 'h', 'gold');
  ck('a bar never goes below 0, and power counts only applied steps', BARS.every(b => s.rolls[b].toSteps === 0) && s.power === 0); T.discardSession(st); }
{ const st = T.newState(); st.heroes = { h: hero(39, 39, 39, 39) }; st.playerLevel = 50; T.setRng(seq([0.999, 0.999, 0.99]));
  const s = T.pray(st, 'h', 'gold'); T.saveSession(st);
  ck('a bar never passes the cap (40 at Temple 1)', BARS.every(b => st.heroes.h.steps[b] <= 40)); }
ck('reach pressure: none at the reach, 0.6 at the cap', T.pressureChance('gold', 20, 40) === 0 && near(T.pressureChance('gold', 40, 40), 0.6, 1e-9) && near(T.pressureChance('gold', 30, 40), 0.3, 1e-9));
ck('Inferno has no pressure (reach = the cap)', T.pressureChance('inferno', 200, 200) === 0);

// pay on pray: discard applies nothing, save applies
{ const st = T.newState(); st.heroes = { h: hero(5, 5, 5, 5) }; st.playerLevel = 50; T.setRng(seq([0.999]));
  T.pray(st, 'h', 'gold'); T.discardSession(st);
  ck('discard applies nothing', BARS.every(b => st.heroes.h.steps[b] === 5));
  T.pray(st, 'h', 'gold'); T.saveSession(st);
  ck('save applies the rolled steps', BARS.every(b => st.heroes.h.steps[b] === 8)); }

// 10% bonus prayer (higher at 8/11/15); 1 free prayer per temple level; free prayers pray the best open tier
{ const st = T.newState(); st.heroes = { h: hero(0, 0, 0, 0) }; st.playerLevel = 50; st.keeperPoints = 0;
  let a = 7; T.setRng(() => { a = (a * 16807) % 2147483647; return a / 2147483647; });
  let won = 0; for (let i = 0; i < 4; i++) { const s = T.pray(st, 'h', 'gold'); if (s.bonusPrayer) won++; T.discardSession(st); }
  st.playerLevel = 85; st.keeperPoints = 1e7; st.levelSeen = T.keeperLevel(1e7, 85); won = 0;
  for (let i = 0; i < 20000; i++) { const s = T.pray(st, 'h', 'gold'); if (s.bonusPrayer) won++; T.discardSession(st); }
  ck('bonus prayer ~16% from Temple 15', near(won / 20000, 0.16, 0.012));
  const u = T.useBonusPrayer(st, 'h'); ck('bonus prayer = best open tier, free', u.tier === 'inferno' && u.free === true); T.discardSession(st); }
{ const st = T.newState(); st.heroes = { h: hero(0, 0, 0, 0) }; st.playerLevel = 85; T.setRng(seq([0.99]));
  for (let i = 0; i < 5; i++) { T.pray(st, 'h', 'gold'); T.discardSession(st); }
  ck('level-up banks 1 free prayer', T.keeperLevel(st.keeperPoints, 85) === 2 && st.bonusPrayers === 1); }
{ const st = T.newState(); st.heroes = { h: hero(0, 0, 0, 0) }; st.playerLevel = 85; st.keeperPoints = pts(17); st.levelSeen = 17; T.setRng(seq([0.5]));
  const before = st.keeperPoints; T.pray(st, 'h', 'inferno'); T.discardSession(st);
  ck('an Inferno prayer earns 40 keeper points', st.keeperPoints - before === 40);
  T.buyGemTier(st, 'inferno'); ck('buying a diamond tier adds no keeper points of its own', st.keeperPoints - before === 40); }

// discounts (10% at 6 / 10 / 12 / 18 / 20) and the Gold ladder cap
{ const st = T.newState(); st.playerLevel = 100; st.keeperPoints = pts(5);
  ck('no discount at Temple 5', T.nextGoldCost(st) === 1000 && T.tierGems(st, 'kindled') === 50);
  st.keeperPoints = pts(6); ck('Gold ritual 10% off at Temple 6', T.nextGoldCost(st) === 900 && T.tierGems(st, 'kindled') === 50);
  st.keeperPoints = pts(20); ck('every tier 10% off at Temple 20', T.prayerTiers(st).map(t => t.gems).join() === '0,45,90,180,360');
  st.goldLadderStep = 40; ck('the Gold ladder caps at 100,000 (90,000 after the discount)', T.nextGoldCost(st) === 90000); }

// blessings: Temple 1/5/13/19 + hero 50/60/70/80 + steps 20/50/130/190; the 5th = hero 100 + Temple 25
{ const st = T.newState(); st.playerLevel = 100; st.keeperPoints = 1e7;
  const h = hero(200, 200, 200, 200), rows = lv => T.blessingsFor(st, h, { role: 'Bruiser', damageProfile: 'Attack', heroLevel: lv }).filter(b => b.canUnlock).map(b => b.slot).join();
  ck('dot gates by hero level', [[49, ''], [50, '1'], [60, '1,2'], [70, '1,2,3'], [80, '1,2,3,4']].every(([hl, want]) => rows(hl) === want));
  st.keeperPoints = pts(12); ck('dot gates by Temple level (12 opens 1-2)', rows(80) === '1,2');
  st.keeperPoints = 1e7; const thin = hero(19, 49, 129, 189);
  ck('control: one step short of every threshold earns nothing', T.blessingsFor(st, thin, { role: 'Bruiser', heroLevel: 100 }).every(b => !b.canUnlock));
  const fat = hero(20, 50, 130, 190); st.heroes = { x: fat };
  ck('at the thresholds all four dots and the 5th light', T.earnBlessings(st, 'x', { role: 'Bruiser', heroLevel: 100 }).join() === '1,2,3,4,5'); }
{ const st = T.newState(); st.playerLevel = 85; st.keeperPoints = 1e7;
  ck('5th orb: hero 100 yes, 99 no', T.fifthOrbReachable(st, 100) === true && T.fifthOrbReachable(st, 99) === false);
  st.keeperPoints = 0; ck('control: 5th orb needs temple 25', T.fifthOrbReachable(st, 100) === false); }

// bonuses: flat stats by damage type; blessings add their class reward; the 5th dot x1.10
{ const b = T.heroBonuses(hero(100, 100, 100, 100), 'Marksman', 'Attack');
  ck('physical: 100 steps = +3,500 health, +240 Attack damage, +720 armor & MR, +480 both pens',
    b.hpFlat === 3500 && b.adFlat === 240 && !b.apFlat && b.armorFlat === 720 && b.mrFlat === 720 && b.armorPenFlat === 480 && b.magicPenFlat === 480);
  const m = T.heroBonuses(hero(100, 100, 100, 100), 'Mage', 'Magic');
  ck('magic: 100 steps = +2,500 health, +320 Ability power, +480 armor & MR, +720 both pens',
    m.hpFlat === 2500 && m.apFlat === 320 && !m.adFlat && m.armorFlat === 480 && m.armorPenFlat === 720);
  const hy = T.heroBonuses(hero(0, 100, 0, 0), 'Bruiser', 'Hybrid');
  ck('hybrid: the Attack bar adds to both Attack damage and Ability power', hy.adFlat === 240 && hy.apFlat === 240);
  const lit = T.heroBonuses(hero(0, 0, 0, 0, [true, true, false, false, false]), 'Marksman', 'Attack');
  ck('Marksman dots 1-2: crit chance +5% and Attack +150 (Phil\'s example)', lit['crit chance'] === 0.05 && lit.adFlat === 150);
  const five = T.heroBonuses(hero(0, 0, 0, 0, [true, true, false, false, true]), 'Marksman', 'Attack');
  ck('5th dot raises everything 10%', five.adFlat === 165 && near(five['crit chance'], 0.055, 1e-9));
  ck('control: no Temple state = no bonus', Object.keys(T.heroBonuses(null, 'Mage')).length === 0); }

// migration: old points -> steps by the same share of the old maximum
{ const st = T.newState(); st.playerLevel = 100; st.keeperPoints = pts(13);
  st.heroes = { old: { cinders: { bar1: 199, bar2: 0, bar3: 50, bar4: 100 }, boonsUnlocked: [true, true] }, now: hero(7, 7, 7, 7) };
  st._pending = { heroId: 'old', rolls: { bar1: { from: 1, delta: 1, to: 2 } } };
  const mx = T.effectMax(13), cap = T.capSteps(13);
  ck('migrates only heroes without steps', T.migrateState(st) === 1 && st.heroes.now.steps.health === 7);
  ck('steps = round(old / old max x cap)', st.heroes.old.steps.health === Math.round(199 / mx * cap) && st.heroes.old.steps.armorMr === Math.round(50 / mx * cap) && st.heroes.old.steps.attack === 0);
  ck('earned orbs stay earned', st.heroes.old.boonsUnlocked[0] && st.heroes.old.boonsUnlocked[1] && st.heroes.old.boonsUnlocked.length === 5);
  ck('an old-format pending prayer is dropped', st._pending === null);
  ck('migration runs once', T.migrateState(st) === 0); }

// UI helper
{ const st = T.newState(); st.playerLevel = 100; st.keeperPoints = pts(13); st.heroes = { h: hero(70, 35, 0, 35) };
  const s = T.heroTempleStats(st, 'h', { role: 'Tank', damageProfile: 'Attack', heroLevel: 80 });
  ck('heroTempleStats: steps, values, cap, pct, 4 blessing rows, 5th', s.cap === 140 && s.values.health === 2450 && s.pct === 25 && s.blessings.length === 4 && s.blessings[0].earned === false && s.blessings[0].canUnlock === true && s.fifth.locked === true); }

// the day key is New York's, injectable
{ T.setDayKey(() => '2026-09-27'); const st = T.newState(); st.heroes = { h: hero(0, 0, 0, 0) }; st.playerLevel = 85;
  const a = T.freeDailyPray(st, 'h'); T.discardSession(st); const b = T.freeDailyPray(st, 'h');
  T.setDayKey(() => '2026-09-28'); const c = T.freeDailyPray(st, 'h'); T.discardSession(st);
  ck('free prayer once per injected day', a.ok !== false && b.ok === false && c.ok !== false); }

console.log('temple of ash: %d passed, %d failed', ok, bad);
process.exit(bad ? 1 : 0);
