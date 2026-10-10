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

// v1098 (Phil 9 Oct): bars 3 and 4 open at Temple 7 and 11 and cannot move before; cap by Temple level
ck('bars 3 / 4 open at Temple 7 / 11', T.CONFIG.BAR_UNLOCK_TEMPLE.join() === '1,1,7,11');
ck('cap 40/75/110/140/170/200', [1, 5, 9, 13, 16, 19].map(T.capSteps).join() === '40,75,110,140,170,200');
const up = T.CONFIG.ROLL_TABLES.gold, upShare = (() => { let u = 0, d = 0; for (const k in up) { if (+k > 0) u += up[k]; else if (+k < 0) d += up[k]; } return u / (u + d); })();
ck('roll 1 keeps the existing Gold success odds (up share of the measured table)', near(upShare, 52 / 68, 1e-9));
// v1098 two rolls (Phil): roll 1 = gain or loss for the whole prayer; roll 2 = how many steps (Gold 1-30), dealt to random open bars
{ const st = T.newState(); st.heroes = { h: hero(10, 10, 10, 10) }; st.playerLevel = 50; T.setRng(seq([0.0, 0.999, 0.3, 0.7]));   // gain, 30 steps
  const s = T.pray(st, 'h', 'gold', { profile: 'Attack' });
  ck('a Temple-1 prayer moves only bars 1-2 (3 and 4 locked)', s.rolls.armorMr.deltaSteps === 0 && s.rolls.pen.deltaSteps === 0);
  ck('roll 2: a Gold gain of 30 power is 3 steps, all on the open bars (v1099: the roll is power, 10 power = 1 step)', s.gain === true && s.amount === 30 && s.steps === 3 && s.net === 3);
  ck('power = 10 x net steps', s.power === 30);
  ck('values are steps x the physical step', s.rolls.health.toValue === s.rolls.health.toSteps * 35); T.discardSession(st); }
{ const st = T.newState(); st.heroes = { h: hero(0, 0, 0, 0) }; st.playerLevel = 50; T.setRng(seq([0.999, 0.999]));   // a loss of 30 on empty bars
  const s = T.pray(st, 'h', 'gold');
  ck('a loss on empty bars takes nothing (never below 0, power counts only applied steps)', s.gain === false && BARS.every(b => s.rolls[b].toSteps === 0) && s.power === 0); T.discardSession(st); }
{ const st = T.newState(); st.heroes = { h: hero(39, 39, 39, 39) }; st.playerLevel = 50; T.setRng(seq([0.0, 0.999, 0.5]));
  const s = T.pray(st, 'h', 'gold'); T.saveSession(st);
  ck('a bar never passes the cap (40 at Temple 1); the extra points have nowhere to go', BARS.every(b => st.heroes.h.steps[b] <= 40) && s.net === 2); }
{ const st = T.newState(); st.heroes = { h: hero(10, 10, 10, 10) }; st.playerLevel = 100; st.keeperPoints = pts(14); const amt = { kindled: [], stoked: [] };
  let a = 5; T.setRng(() => { a = (a * 16807) % 2147483647; return a / 2147483647; });
  for (let i = 0; i < 300; i++) for (const t of ['kindled', 'stoked']) { const s = T.pray(st, 'h', t); amt[t].push(s.gain ? s.amount : -s.amount); T.discardSession(st); }
  const R = T.CONFIG.PRAYER_AMOUNT; const inR = (t) => amt[t].every(v => v > 0 ? [1, 2, 3].some(m => v % m === 0 && v / m >= R[t].gain[0] && v / m <= R[t].gain[1]) : -v >= R[t].loss[0] && -v <= R[t].loss[1]);   // gains may be a x2 / x3 breakout
  ck('every amount is inside the tier gain / loss range', inR('kindled') && inR('stoked'));
  ck('amounts are random, not fixed (many distinct values)', new Set(amt.kindled).size > 20); }
// v1099 (Phil 9 Oct: Gold +260 / Kindled +390 'way too much'): a prayer moves about as much as a measured reference prayer
{ const st = T.newState(); st.heroes = { h: hero(10, 10, 10, 10) }; st.playerLevel = 100; st.keeperPoints = pts(19); let a = 7; T.setRng(() => { a = (a * 16807) % 2147483647; return a / 2147483647; });
  const mx = {}; for (const t of ['gold', 'kindled', 'inferno']) { mx[t] = 0; for (let i = 0; i < 400; i++) { const s = T.pray(st, 'h', t); mx[t] = Math.max(mx[t], Math.abs(s.power)); T.discardSession(st); } }
  ck('Gold never moves more than 30 power without a breakout x3 (90); Kindled 150; Inferno 600', mx.gold <= 90 && mx.kindled <= 150 && mx.inferno <= 600 && mx.gold > 0);
  ck('a normal Gold prayer is +10..+30 power, not +260 (control: the old step reading)', T.CONFIG.PRAYER_AMOUNT.gold.gain[1] / T.CONFIG.POWER_PER_STEP === 3); }
ck('higher tiers gain more and lose less', ['gold', 'kindled', 'stoked', 'blazing', 'inferno'].every((t, i, a) => !i || (T.CONFIG.PRAYER_AMOUNT[t].gain[1] > T.CONFIG.PRAYER_AMOUNT[a[i - 1]].gain[1] && T.CONFIG.PRAYER_AMOUNT[t].loss[1] <= T.CONFIG.PRAYER_AMOUNT[a[i - 1]].loss[1])));
// v1098 breakout (Phil): 5% x2, 1% x3, gains only
ck('breakout chances are 1% x3 and 5% x2', JSON.stringify(T.CONFIG.BREAKOUT) === '[{"chance":0.01,"mult":3},{"chance":0.05,"mult":2}]');
{ const st = T.newState(); st.heroes = { h: hero(0, 0, 0, 0) }; st.playerLevel = 100; st.keeperPoints = pts(19); T.setRng(seq([0.0, 0.999, 0.005, 0.5]));
  const s = T.pray(st, 'h', 'gold'); ck('a 1% roll is a x3 breakout: Gold 30 becomes 90 power (9 steps)', s.breakout === 3 && s.amount === 90 && s.net === 9); T.discardSession(st); }
{ const st = T.newState(); st.heroes = { h: hero(0, 0, 0, 0) }; st.playerLevel = 100; st.keeperPoints = pts(19); T.setRng(seq([0.0, 0.999, 0.03, 0.5]));
  const s = T.pray(st, 'h', 'gold'); ck('a 5% roll is a x2 breakout: Gold 30 becomes 60', s.breakout === 2 && s.amount === 60); T.discardSession(st); }
{ const st = T.newState(); st.heroes = { h: hero(100, 100, 100, 100) }; st.playerLevel = 100; st.keeperPoints = pts(19); T.setRng(seq([0.999, 0.999, 0.0, 0.5]));
  const s = T.pray(st, 'h', 'gold'); ck('a loss is never multiplied (control)', s.gain === false && s.breakout === 1 && s.amount === 30); T.discardSession(st); }
// v1101 (Phil 9 Oct): "when you have a free prayer, you dont get free daily prayers unless you use it"
{ const st = T.newState(); st.bonusPrayers = 2; ck('holding a stored free prayer: the daily one does not arrive', T.freeRitualAvailable(st) === false);
  st.bonusPrayers = 0; ck('control: none stored and not used today: the daily free prayer is there', T.freeRitualAvailable(st) === true); }
ck('Inferno gains 50-200 (Phil)', T.CONFIG.PRAYER_AMOUNT.inferno.gain.join() === '50,200');
ck('reach pressure: none at the reach, 0.6 at the cap', T.pressureChance('gold', 20, 40) === 0 && near(T.pressureChance('gold', 40, 40), 0.6, 1e-9) && near(T.pressureChance('gold', 30, 40), 0.3, 1e-9));
ck('Inferno has no pressure (reach = the cap)', T.pressureChance('inferno', 200, 200) === 0);

// pay on pray: discard applies nothing, save applies exactly what was rolled
{ const st = T.newState(); st.heroes = { h: hero(5, 5, 5, 5) }; st.playerLevel = 50; T.setRng(seq([0.0, 0.5, 0.2, 0.8]));
  T.pray(st, 'h', 'gold'); T.discardSession(st);
  ck('discard applies nothing', BARS.every(b => st.heroes.h.steps[b] === 5));
  const s = T.pray(st, 'h', 'gold'); T.saveSession(st);
  ck('save applies the rolled steps', BARS.every(b => st.heroes.h.steps[b] === s.rolls[b].toSteps)); }

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
  st.keeperPoints = 1e7; const thin = hero(34, 69, 129, 189);
  ck('control: one step short of every threshold earns nothing', T.blessingsFor(st, thin, { role: 'Bruiser', heroLevel: 100 }).every(b => !b.canUnlock));
  const fat = hero(35, 70, 130, 190); st.heroes = { x: fat };
  ck('at the thresholds all four dots and the 5th light', T.earnBlessings(st, 'x', { role: 'Bruiser', heroLevel: 100 }).join() === '1,2,3,4,5'); }
{ const st = T.newState(); st.playerLevel = 85; st.keeperPoints = 1e7;
  ck('5th orb: hero 100 yes, 99 no', T.fifthOrbReachable(st, 100) === true && T.fifthOrbReachable(st, 99) === false);
  st.keeperPoints = 0; ck('control: 5th orb needs temple 25', T.fifthOrbReachable(st, 100) === false); }

// bonuses: flat stats by damage type; blessings add their reward (class fallback for an unknown key); the 5th dot x1.15 on blessings only
{ const b = T.heroBonuses(hero(100, 100, 100, 100), 'Marksman', 'Attack');
  ck('physical: 100 steps = +3,500 health, +240 Attack damage, +720 armor & MR, +480 both pens',
    b.hpFlat === 3500 && b.adFlat === 240 && !b.apFlat && b.armorFlat === 720 && b.mrFlat === 720 && b.armorPenFlat === 480 && b.magicPenFlat === 480);
  const m = T.heroBonuses(hero(100, 100, 100, 100), 'Mage', 'Magic');
  ck('magic: 100 steps = +2,500 health, +320 Ability power, +480 armor & MR, +720 both pens',
    m.hpFlat === 2500 && m.apFlat === 320 && !m.adFlat && m.armorFlat === 480 && m.armorPenFlat === 720);
  const hy = T.heroBonuses(hero(0, 100, 100, 0), 'Bruiser', 'Hybrid', 'aureth');
  ck('v1098 hybrid: Aureth has his own Attack damage bar AND Ability power bar (100 steps: +240 / +320)', hy.adFlat === 240 && hy.apFlat === 320);
  const lit = T.heroBonuses(hero(0, 0, 0, 0, [true, true, false, false, false]), 'Marksman', 'Attack');
  ck('Marksman dots 1-2: crit chance +5% and Attack +150 (Phil\'s example)', lit['crit chance'] === 0.05 && lit.adFlat === 150);
  const five = T.heroBonuses(hero(0, 0, 0, 0, [true, true, false, false, true]), 'Marksman', 'Attack');
  ck('5th dot raises the blessings 15%', five.adFlat === 173 && near(five['crit chance'], 0.0575, 1e-9));
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
