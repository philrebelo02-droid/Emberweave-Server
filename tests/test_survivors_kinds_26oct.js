/* Swarm Spire skill mechanics (26 Oct 2026, Phil: "make all spells work mechanically"). Claude.
   Proves on the core (server/survivors-core.js): a skill's own effect lands (stun / slow / pull / dot / vuln from the spell's game row),
   CHAIN jumps from enemy to enemy and stops at its jump count, SUMMON calls up n allies that rise, chase, strike and expire, and a run
   with every new kind is still deterministic (same seed + presses = same result). Control: a plain nova still knocks back and stuns nobody.
   Run: node tests/test_survivors_kinds_26oct.js */
'use strict';
const path = require('path');
const C = require(path.join(__dirname, '..', 'server', 'survivors-core.js'));
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; } else { fail++; console.log('FAIL', name, extra === undefined ? '' : extra); } }

const HERO = { key: 'test', cls: 'Mage', maxHp: 1e9, atk: 300, armor: 400, crit: 0, critDmg: 0.6 };
function rig(skills, mons) {
  const S = C.create(Object.assign({ skills }, HERO), { seed: 3 });
  S.noSpawn = true; S._baseT = 1e9;
  mons.forEach(([x, y]) => S.monsters.push({ id: S.nextId++, type: 'brute', x, y, hp: 1e7, maxHp: 1e7, dmg: 0, spd: 0, r: 0.6 }));
  return S;
}
const press = (S, i) => C.step(S, { skill: i }), idle = (S, n) => { for (let k = 0; k < n; k++) C.step(S, {}); };

// 1. effects from the spell row
for (const [fk, field] of [['stun', 'stunT'], ['slow', 'slowT'], ['dot', 'dotT'], ['vuln', 'vuln']]) {
  const S = rig([{ key: 'k_' + fk, kind: 'nova', cd: 5, power: 1, fk, fp: 2 }], [[1.5, 0]]);
  press(S, 0); ok('nova ' + fk + ' lands', S.monsters[0][field] > 0, S.monsters[0]);
}
{ const S = rig([{ key: 'k_pull', kind: 'nova', cd: 5, power: 1, fk: 'pull', fp: 2.5 }], [[3, 0]]); press(S, 0);
  ok('nova pull draws the enemy in', S.monsters[0].x < 3, S.monsters[0].x); }
{ const S = rig([{ key: 'k_plain', kind: 'nova', cd: 5, power: 1 }], [[2, 0]]); press(S, 0);   // CONTROL: the old nova
  ok('control: plain nova knocks back', S.monsters[0].x > 2, S.monsters[0].x); ok('control: plain nova stuns nobody', !(S.monsters[0].stunT > 0)); }
{ const S = rig([{ key: 'k_bad', kind: 'nova', cd: 5, power: 1, fk: 'explode' }], [[2, 0]]);
  ok('an unknown effect is dropped', S.hero.kit[0].fk === '', S.hero.kit[0].fk); }

// 2. chain: 6 enemies 3 m apart in a line, 4 jumps = 5 struck; a 7th 9 m past the last is never reached
{ const line = [1, 4, 7, 10, 13, 16].map(x => [x, 0]).concat([[25, 0]]);
  const S = rig([{ key: 'k_chain', kind: 'chain', cd: 5, power: 1, jumps: 4 }], line); const hp0 = S.monsters.map(m => m.hp);
  press(S, 0); const hitN = S.monsters.filter((m, i) => m.hp < hp0[i]).length;
  ok('chain strikes jumps+1 enemies', hitN === 5, hitN); ok('chain never reaches the far one', S.monsters[6].hp === hp0[6]);
  ok('chain stuns by default', S.monsters[0].stunT > 0); ok('chain draws one arc per link', S.fx.filter(f => f.kind === 'bolt2').length === 5);
  ok('chain fades 20% a jump', (hp0[1] - S.monsters[1].hp) < (hp0[0] - S.monsters[0].hp)); }

// 3. summon: 3 allies rise, walk to an enemy 6 m away, strike it, then expire after dur
{ const S = rig([{ key: 'k_sum', kind: 'summon', cd: 5, power: 0.4, n: 3, dur: 6, unit: 'boar warrior' }], [[6, 0]]); const hp0 = S.monsters[0].hp;
  press(S, 0); ok('summon calls n allies', (S.allies || []).length === 3, (S.allies || []).length);
  ok('allies carry their unit', S.allies.every(a => a.unit === 'boar warrior'));
  idle(S, 30 * 3); ok('allies reach and strike the enemy', S.monsters[0].hp < hp0, hp0 - S.monsters[0].hp);
  ok('an ally walked to it', S.allies.some(a => Math.hypot(a.x - 6, a.y) < 2));
  idle(S, 30 * 4); ok('allies expire after dur', S.allies.length === 0, S.allies.length); }
{ const S = rig([{ key: 'k_sum', kind: 'summon', cd: 1, power: 0.4, n: 6, dur: 60, unit: 'x' }], []);
  press(S, 0); idle(S, 35); press(S, 0); ok('never more than 8 allies', S.allies.length === 8, S.allies.length); }
{ const S = rig([{ key: 'k_sum', kind: 'summon', cd: 5, power: 0.4, n: 1, dur: 30, unit: 'x' }], []); press(S, 0);
  for (let k = 0; k < 30 * 6; k++) C.step(S, { mx: 100, my: 0 });
  ok('an ally left far behind comes back to you', Math.hypot(S.allies[0].x - S.hero.x, S.allies[0].y - S.hero.y) < 20); }

// 4. determinism with all the new kinds
function run() { const S = rig([{ key: 'a', kind: 'chain', cd: 2, power: 1, jumps: 3 }, { key: 'b', kind: 'summon', cd: 4, power: 0.5, n: 2, dur: 5, unit: 'x', fk: 'slow' }],
    [[2, 1], [4, -1], [6, 2], [8, 0], [-3, 2]]);
  for (let k = 0; k < 600; k++) C.step(S, { skill: k % 90 === 0 ? 0 : k % 150 === 5 ? 1 : null, mx: Math.sin(k / 40), my: Math.cos(k / 40) });
  return JSON.stringify(S.monsters.map(m => Math.round(m.hp))) + '|' + (S.allies || []).length; }
ok('same seed + presses = same run', run() === run());

console.log(fail ? 'test_survivors_kinds_26oct: ' + fail + ' FAILED, ' + pass + ' passed' : 'test_survivors_kinds_26oct: ' + pass + ' checks passed');
process.exit(fail ? 1 : 0);
