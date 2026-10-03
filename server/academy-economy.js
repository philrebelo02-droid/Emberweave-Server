'use strict';

// Academy level economy (Phil, 3 Oct 2026). One home for the numbers; the client carries a copy that
// tests/test_academy_economy.js holds equal to this one.
// COST[n-1] = what upgrading the Academy TO level n costs, of EACH of the four resources (all four are
// equal in worth). Levels 1-115 are the reference's Academy table; 116-120 extend it at +3.69% a level.
const MAX_LEVEL = 120;
const COST = [64,109,203,349,575,667,763,1048,1349,1529,1701,1880,2065,2257,2455,2817,3193,3583,3986,4424,
  4609,4812,5031,5269,5526,5804,6105,6430,6779,7158,7493,7850,8231,8639,9075,9539,10033,10558,11115,11706,
  12334,13000,13701,14446,15230,16061,16935,17858,18828,19850,20927,22056,23243,24487,25797,27168,28604,30107,31681,33329,
  35054,36853,38735,40699,42750,44891,47122,49447,51872,54395,57023,59757,62604,65566,68642,73279,78172,83334,88781,94516,
  100559,106922,113616,120659,128061,135839,144012,152585,161588,171032,178190,185595,193260,201182,209376,239633,271920,306342,342990,381969,
  396922,412360,428299,444751,461719,479230,497296,515931,535135,554940,575358,596401,618085,640429,663441,687922,713306,739627,766919,795218];
const RESOURCES = ['iron', 'crystal', 'silver', 'coal'];

// Cost of upgrading the Academy to `level` (1..MAX_LEVEL), each resource; 0 outside the table.
function levelCost(level) {
  const n = Math.floor(+level || 0);
  return n >= 1 && n <= MAX_LEVEL ? COST[n - 1] : 0;
}

// Phil: an Academy at level N earns its NEXT upgrade's cost over 24 + 2(N-1) hours, free, of each resource,
// and "the resource amount should never go down" - a level never earns less than the level below it.
const RATE = [0];
for (let n = 1; n <= MAX_LEVEL; n++) {
  const next = n < MAX_LEVEL ? COST[n] / (24 + 2 * (n - 1)) : 0;
  RATE.push(Math.max(RATE[n - 1], next));
}
function ratePerHour(level) {
  const n = Math.max(0, Math.min(MAX_LEVEL, Math.floor(+level || 0)));
  return RATE[n];
}

// Whole units of each resource earned at `level` from `since` to `until`, and the time those units account for
// (the remainder carries to the next collection, so nothing is lost or paid twice).
function earned(level, since, until) {
  const rate = ratePerHour(level);
  const ms = Math.max(0, (+until || 0) - (+since || 0));
  if (!(rate > 0) || !(ms > 0)) return { units: 0, usedMs: 0 };
  const units = Math.floor(rate * ms / 3600000);
  return { units, usedMs: units > 0 ? Math.ceil(units * 3600000 / rate) : 0 };
}

// Witches Hut upgrade (Phil 3 Oct): half the Academy upgrade at the same level, of each resource.
function hutUpgradeCost(level) {
  return Math.ceil(levelCost(level) / 2);
}

module.exports = { MAX_LEVEL, COST, RESOURCES, RATE, levelCost, ratePerHour, earned, hutUpgradeCost };
