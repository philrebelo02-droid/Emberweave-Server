// v1433 supersedes v1353's single-rate rule (Phil 23 Nov 2026, after the testers: "It needs to be a fair gain or not gain as the temple level
// rides and percentage of heroes completion rises" / "Lower prayers should work less as the heroes completion % goes up" / "Should require
// upgraded prayer" / "% of total stats the hero can get at 50. Gold can never work after 25% of those total stats / The 50 diamonds can never
// work passed 40% / The 100 diamond ... 55% / The 200 diamonds ... 70% / Up until 100% at level 50 the only way to get max is 400 diamonds one"
// / "little more gradual than that but yes" / "the % is based on the MAX temple level not the current" / "25% of these numbers can never be
// exceeded with gold prayer ... by vex").
//   per HERO, per BAR: fill = the bar's steps against the Temple 50 cap (320); chance of a GAIN = 1 - (fill / REACH[tier]) ^ 1.5;
//   a prayer only raises bars below its ceiling (REACH x 320); none left = refused, nothing spent; no gain = no change (never a loss).
// (File name kept from v1353 so the history stays in one place.)
const path = require('path');
const ROOT = path.join(__dirname, '..'); const T = require(path.join(ROOT, 'server', 'temple-of-ash.js'));
let P = 0, F = 0; const ck = (n, c, x) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n + (x !== undefined ? ' - ' + JSON.stringify(x) : '')); } };
const near = (a, b, e) => Math.abs(a - b) < (e || 1e-9), S = T.CONFIG.SUCCESS, TIERS = ['gold', 'kindled', 'stoked', 'blazing', 'inferno'];

ck('the reaches are Phil\'s: Gold 25 %, 50 diamonds 40 %, 100 diamonds 55 %, 200 diamonds 70 %, 400 diamonds 100 % of the Temple 50 total',
  JSON.stringify(S.REACH) === JSON.stringify({ gold: 0.25, kindled: 0.40, stoked: 0.55, blazing: 0.70, inferno: 1.00 }));
ck('the fill is against the Temple 50 total (320 steps a bar), and the cap rises at 25, 33, 40 and 48',
  T.MAX_CAP_STEPS === 320 && T.capSteps(50) === 320 && [25, 33, 40, 48].every(L => T.CAP_RAISE_LEVELS.includes(L)) && T.capSteps(24) < T.capSteps(25) && T.capSteps(47) < T.capSteps(48));
ck('an empty bar gains every time, with every prayer', TIERS.every(t => near(T.successChance(1, 0, t), 1)));
ck('the Temple level does not change the rate (it only sets the cap)', TIERS.every(t => [1, 19, 50].every(L => near(T.successChance(L, 0.1, t), T.successChance(1, 0.1, t)))));
ck('the curve is 1 - (fill / reach) ^ 1.5 - gentle first, steeper near the reach',
  near(T.successChance(50, 0.125, 'gold'), 1 - Math.pow(0.5, 1.5)) && T.successChance(50, 0.05, 'gold') - T.successChance(50, 0.10, 'gold') < T.successChance(50, 0.15, 'gold') - T.successChance(50, 0.20, 'gold'));
ck('higher prayers work better on the same bar (Gold < 50 < 100 < 200 < 400 diamonds)',
  [0.05, 0.15, 0.24].every(c => TIERS.every((t, i) => i === 0 || T.successChance(50, c, t) > T.successChance(50, c, TIERS[i - 1]))));
for (const t of TIERS) { const r = S.REACH[t];
  ck(t + ': works just under its reach, never at or past it', T.successChance(50, r - 0.01, t) > 0 && T.successChance(50, r, t) === 0 && T.successChance(50, Math.min(1, r + 0.05), t) === 0);
  const a = T.successChance(50, r * 0.2, t), b = T.successChance(50, r * 0.5, t), c = T.successChance(50, r * 0.8, t);
  ck(t + ': the chance falls as the bar fills', a > b && b > c);
  ck(t + ': its ceiling is ' + Math.floor(r * 320) + ' steps (never above the cap)', T.tierCeiling(t, 320) === Math.floor(r * 320 + 1e-9) && T.tierCeiling(t, 40) === Math.min(40, Math.floor(r * 320 + 1e-9))); }
ck('only the 400-diamond prayer can still work at 99 % of the total', TIERS.filter(t => T.successChance(50, 0.99, t) > 0).join() === 'inferno');

// real prayers on a Temple 50 hero
const mk = (fills) => { const st = { keeperPoints: 5e6, playerLevel: 120, heroes: {} }; T.pray(st, 'h', 'gold'); T.discardSession(st);   // make the hero
  const steps = st.heroes.h.steps; Object.keys(steps).forEach((k, i) => { steps[k] = Array.isArray(fills) ? fills[i] : fills; }); return st; };
ck('the test hero is at Temple 50', T.keeperLevel(5e6, 120) === 50);
T.setRng(Math.random);
let losses = 0, nothings = 0, gains = 0, over = 0;
for (let k = 0; k < 400; k++) { const st = mk(160); const s = T.pray(st, 'h', 'inferno'); if (!s || s.ok === false) continue;
  if (s.net < 0) losses++; else if (s.net === 0) nothings++; else gains++; T.discardSession(st); }
ck('a 400-diamond prayer at 50 %: gains or nothing, never a loss (' + gains + ' gains, ' + nothings + ' nothing, ' + losses + ' losses)', losses === 0 && gains > 0 && nothings > 0);
for (let k = 0; k < 300; k++) { const st = mk([0, 78, 79, 80]); const s = T.pray(st, 'h', 'gold'); if (!s || s.ok === false) continue;
  for (const b of Object.keys(s.rolls)) if (s.rolls[b].toSteps > 80) over++; T.discardSession(st); }
ck('a Gold prayer never lifts a bar past 80 steps (25 % of 320) - bars at the ceiling stay put', over === 0, over);
const fullGold = T.pray(mk(80), 'h', 'gold');
ck('a Gold prayer on a hero with every bar at 25 % is refused ("needs_higher_prayer")', fullGold && fullGold.ok === false && fullGold.reason === 'needs_higher_prayer', fullGold);
const kindled = T.pray(mk(80), 'h', 'kindled');
ck('... but the 50-diamond prayer still works on it', kindled && kindled.ok !== false, kindled && kindled.reason);
const full = T.pray(mk(320), 'h', 'inferno');
ck('a hero full at Temple 50 is refused even by the 400-diamond prayer ("hero_full_for_temple")', full && full.ok === false && full.reason === 'hero_full_for_temple', full);
console.log('test_temple_success_1353.js (v1433 rules): ' + P + ' passed, ' + F + ' failed'); process.exitCode = F ? 1 : 0;
