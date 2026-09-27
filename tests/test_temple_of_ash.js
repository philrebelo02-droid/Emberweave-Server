// test_temple_of_ash.js - every Phil ruling in temple-of-ash.js, checked (Claude 27 Sep 2026). Run: node test_temple_of_ash.js [path/to/temple-of-ash.js]
// Goes into the repo as tests/test_temple_of_ash.js next to server/temple-of-ash.js (pass that path).
const path = require('path');
const T = require(path.resolve(process.argv[2] || path.join(__dirname, '..', 'server', 'temple-of-ash.js')));
let ok = 0, bad = 0;
const ck = (name, cond) => { if (cond) ok++; else { bad++; console.log('FAIL', name); } };
const near = (a, b, e) => Math.abs(a - b) <= e;
const seq = vals => { let i = 0; return () => vals[i++ % vals.length]; };

// success: 100% at 0% completion; each tier doubles gold; gold anchors at 50% complete (T5 ~35%, T12 1%, T30 0.1%)
ck('0% complete = 100% on every tier', ['gold', 'kindled', 'stoked', 'blazing', 'inferno'].every(t => T.passRate(t, 0, 30) === 1));
ck('gold T5 @50% ~35%', near(T.passRate('gold', .5, 5), .35, .01));
ck('gold T12 @50% = 1%', near(T.passRate('gold', .5, 12), .01, .0005));
ck('gold T30 @50% = 0.1%', near(T.passRate('gold', .5, 30), .001, .0001));
ck('each tier doubles', near(T.passRate('stoked', .5, 20) / T.passRate('kindled', .5, 20), 2, 1e-9));
ck('higher temple, same completion = lower chance', T.passRate('kindled', .43, 5) < T.passRate('kindled', .43, 4));
ck('control: more completion = lower chance', T.passRate('gold', .6, 5) < T.passRate('gold', .4, 5));

// tiers unlock at temple 2/7/14/17 (our names)
ck('tiers at T6', T.tiersOpen(6).map(t => t.id).join() === 'gold,kindled');
ck('tiers at T17', T.tiersOpen(17).map(t => t.id).join() === 'gold,kindled,stoked,blazing,inferno');
{ const st = T.newState(); st.heroes = { h: { cinders: {} } }; st.playerLevel = 85;
  ck('control: a locked tier is refused', T.pray(st, 'h', 'inferno').ok === false); }

// keeper track: per-level exp (the reference's "Lv 19 2747/6500"), player gates follow the dots
{ let sum = 0; for (const x of [0, 5, 15, 25, 50, 100, 200, 400, 600, 800, 1000, 1200, 1400, 1800, 2200, 2800, 3200, 3900, 4600]) sum += x;
  const p = T.keeperProgress(sum + 2747, 85); ck('keeper bar 19 / 2747 / 6500', p.level === 19 && p.into === 2747 && p.need === 6500); }
ck('player gates 50->12, 60->18, 70->24, 80->40, 90->50', [[50, 12], [60, 18], [70, 24], [80, 40], [90, 50]].every(([pl, t]) => T.keeperLevel(1e9, pl) === t));

// 4 bars, bars 3-4 at temple 3/4; a temple-1 prayer rolls only bars 1-2
ck('bars open 2/3/4', T.barsOpen(1).length === 2 && T.barsOpen(3).length === 3 && T.barsOpen(4).length === 4);
{ const st = T.newState(); st.heroes = { h: { cinders: {} } }; st.playerLevel = 50; T.setRng(seq([0.3]));
  const s = T.pray(st, 'h', 'gold'); ck('temple-1 prayer rolls bar1+bar2 only', Object.keys(s.rolls).join() === 'bar1,bar2'); T.discardSession(st); }

// 10% bonus prayer; 1 free prayer per temple level; free prayers pray the best open tier
{ const st = T.newState(); st.heroes = { h: { cinders: {} } }; st.playerLevel = 85; st.keeperPoints = 1e7; st.levelSeen = T.keeperLevel(1e7, 85);
  let a = 7; T.setRng(() => { a = (a * 16807) % 2147483647; return a / 2147483647; });
  let won = 0; for (let i = 0; i < 20000; i++) { const s = T.pray(st, 'h', 'gold'); if (s.bonusPrayer) won++; T.discardSession(st); }
  ck('bonus prayer ~10%', near(won / 20000, 0.10, 0.01));
  const u = T.useBonusPrayer(st, 'h'); ck('bonus prayer = best open tier, free', u.tier === 'inferno' && u.free === true); T.discardSession(st); }
{ const st = T.newState(); st.heroes = { h: { cinders: {} } }; st.playerLevel = 85; T.setRng(seq([0.99]));
  for (let i = 0; i < 5; i++) { T.pray(st, 'h', 'gold'); T.discardSession(st); }
  ck('level-up banks 1 free prayer', T.keeperLevel(st.keeperPoints, 85) === 2 && st.bonusPrayers === 1); }

// orbs: hero level 50/60/70/80 (+ temple 1/5/13/19 + bar threshold); 5th = hero 100 + temple 25
{ const h = { cinders: { bar1: 999, bar2: 999, bar3: 999, bar4: 999 }, boonsUnlocked: [] };
  ck('orb gates by hero level', [[49, ''], [50, '1'], [60, '1,2'], [70, '1,2,3'], [80, '1,2,3,4']].every(([hl, want]) => T.boonsFor(1e7, h, hl).filter(b => b.canUnlock).map(b => b.slot).join() === want)); }
{ const st = T.newState(); st.playerLevel = 85; st.keeperPoints = 1e7;
  ck('5th orb: hero 100 yes, 99 no', T.fifthOrbReachable(st, 100) === true && T.fifthOrbReachable(st, 99) === false);
  st.keeperPoints = 0; ck('control: 5th orb needs temple 25', T.fifthOrbReachable(st, 100) === false); }

// bonuses: a full bar = EFFECT_FULL; boons add; the 5th orb x1.10; unknown class = nothing
{ const full = T.effectMax(50), h = { cinders: { bar1: full, bar2: 0, bar3: 0, bar4: 0 }, boonsUnlocked: [] };
  ck('full Marksman bar1 = +20% attack damage', T.heroBonuses(h, 'Marksman')['attack damage'] === 0.2);
  h.cinders.bar1 = full / 2; ck('half bar = half value', near(T.heroBonuses(h, 'Marksman')['attack damage'], 0.1, 1e-4));
  h.boonsUnlocked = [true, false, false, false]; ck('boon 1 adds its class effect', T.heroBonuses(h, 'Marksman')['armor penetration'] === 0.05);
  h.boonsUnlocked = [true, true, true, true, true]; ck('5th orb raises everything 10%', near(T.heroBonuses(h, 'Marksman')['attack damage'], 0.11, 1e-4));
  ck('control: unknown class = no bonus', Object.keys(T.heroBonuses(h, 'Nobody')).length === 0); }

// a SAVE keeps the whole bar (13:0x: an old 225 cap clipped saves) and the day key is New York's, injectable
{ const st = T.newState(); st.playerLevel = 100; st.keeperPoints = 1e7; const max = T.effectMax(T.keeperLevel(1e7, 100));
  st.heroes = { h: { cinders: { bar1: max - 1, bar2: max - 1, bar3: max - 1, bar4: max - 1 }, boonsUnlocked: [] } };
  T.setRng(seq([0.0]));                                   // every roll passes
  const s = T.pray(st, 'h', 'inferno'); T.saveSession(st);
  ck('a save reaches the bar maximum (' + max + ')', st.heroes.h.cinders.bar1 === max && s.rolls.bar1.to === max);
  ck('control: a save never exceeds the maximum', Object.values(st.heroes.h.cinders).every(v => v <= max)); }
{ T.setDayKey(() => '2026-09-27'); const st = T.newState(); st.heroes = { h: { cinders: {} } }; st.playerLevel = 85;
  const a = T.freeDailyPray(st, 'h'); T.discardSession(st); const b = T.freeDailyPray(st, 'h');
  T.setDayKey(() => '2026-09-28'); const c = T.freeDailyPray(st, 'h'); T.discardSession(st);
  ck('free prayer once per injected day', a.ok !== false && b.ok === false && c.ok !== false); }

console.log('temple of ash: %d passed, %d failed', ok, bad);
process.exit(bad ? 1 : 0);
