/* Hero Survivors - the simulation core (server/survivors-core.js). Claude, 24 Oct 2026.
   Proves: determinism (same seed + inputs = same run), replay from the input log, the level-up pick pauses the clock,
   every one of the 60 auras deals damage at level 1 AND level 10, a 30-minute Story run reaches its boss in bounded time,
   Survive scores, and the hero's own skill BUTTONS (cooldowns, heal, ward, replay of presses). Run: node tests/test_survivors_core.js */
'use strict';
const path = require('path');
const C = require(path.join(__dirname, '..', 'server', 'survivors-core.js'));
const AURAS = require(path.join(__dirname, '..', 'server', 'survivors-auras.json'));
let pass = 0, fail = 0;
function ok(name, cond, extra) { if (cond) { pass++; } else { fail++; console.log('FAIL', name, extra === undefined ? '' : extra); } }

const HERO = { key: 'rhukk', cls: 'Tank', maxHp: 4000, atk: 300, armor: 400, crit: 0.1, critDmg: 0.6, lifesteal: 0 };
// a bot: walks a slow circle (the horde follows), takes pick 0, presses ult whenever it is full
function botRun(opts, ticks) {
  const S = C.create(HERO, Object.assign({ auras: AURAS }, opts));
  for (let i = 0; i < ticks && !S.ended; i++) {
    const a = S.tick * 0.004;
    S.choice ? C.step(S, { mx: Math.cos(a), my: Math.sin(a), pick: 0 }) : C.step(S, { mx: Math.cos(a), my: Math.sin(a), ult: S.hero.ult >= S.hero.ultMax });
  }
  return S;
}

// 1. table: 60 auras, 10 per class, every family has a 10-step ladder with level 10 special
ok('60 auras', AURAS.length === 60, AURAS.length);
['Tank', 'Bruiser', 'Mage', 'Support', 'Assassin', 'Marksman'].forEach(c => ok('10 auras ' + c, AURAS.filter(a => a.cls === c).length === 10));
Object.keys(C.LADDER).forEach(f => { ok('ladder ' + f + ' has 10', C.LADDER[f].length === 10); ok('ladder ' + f + ' L10 special', C.LADDER[f][9].special === true); });
ok('every aura family has a ladder', AURAS.every(a => C.LADDER[a.fam]));

// 2. determinism: two identical bot runs, identical digests
const r1 = botRun({ seed: 42, mode: 'story', stage: 1 }, 30 * 120), r2 = botRun({ seed: 42, mode: 'story', stage: 1 }, 30 * 120);
ok('deterministic (same seed, same inputs)', C.digest(r1) === C.digest(r2), C.digest(r1));
const r3 = botRun({ seed: 43, mode: 'story', stage: 1 }, 30 * 120);
ok('a different seed is a different run', C.digest(r1) !== C.digest(r3));

// 3. replay from the input log reproduces the run exactly
const rep = C.replay(HERO, { seed: 42, mode: 'story', stage: 1, auras: AURAS }, r1.inputs, r1.tick);
ok('replay == live run', C.digest(rep) === C.digest(r1), C.digest(rep) + ' vs ' + C.digest(r1));
// control: a tampered log (one extra pick changed) must NOT reproduce it
const bad = r1.inputs.map(e => e.slice()); const ci = bad.findIndex(e => e[1] === 'c'); if (ci >= 0) bad[ci][2] = 2;
const repBad = C.replay(HERO, { seed: 42, mode: 'story', stage: 1, auras: AURAS }, bad, r1.tick);
ok('CONTROL: a changed pick changes the result', ci >= 0 && C.digest(repBad) !== C.digest(r1));

// 4. levelling happened, the pick pauses the clock
ok('the bot levelled up', r1.hero.level > 3, r1.hero.level);
ok('it picked auras/passives', Object.keys(r1.hero.auras).length + Object.keys(r1.hero.passives).length > 0);
{
  const S = C.create(HERO, { seed: 7, auras: AURAS });
  S.choice = C.offers(S); const t0 = S.t;
  for (let i = 0; i < 30; i++) C.step(S, { mx: 1, my: 0 });
  ok('time stops while a pick is open', S.t === t0 && S.choice, S.t);
  C.step(S, { mx: 1, my: 0, pick: 0 });
  ok('a pick closes the choice', S.choice === null);
  ok('slots respected', Object.keys(S.hero.auras).length <= C.SLOTS.aura && Object.keys(S.hero.passives).length <= C.SLOTS.passive);
}

// 5. every one of the 60 auras deals damage, at level 1 and level 10 (a hero of its class in a ring of monsters)
let silent = [];
const HITTERS = AURAS.filter(a => !(a.fam === 'trigger' && ['guard', 'heal', 'speed', 'vuln'].includes(C.fxKind(a.fx))));
HITTERS.forEach(a => {
  [1, 10].forEach(lv => {
    const hero = Object.assign({}, HERO, { cls: a.cls });
    const S = C.create(hero, { seed: 5, auras: AURAS });
    S.hero.auras[a.key] = lv; S.hero.maxHp = S.hero.hp = 1e9; S._baseT = 1e9;       // no base attack: only the aura can hurt
    for (let k = 0; k < 40; k++) { const ang = k / 40 * Math.PI * 2, d = 1.2 + (k % 4) * 1.1; S.monsters.push({ id: S.nextId++, type: 'brute', x: Math.cos(ang) * d, y: Math.sin(ang) * d, hp: 1e6, maxHp: 1e6, dmg: 1, spd: 0, r: 0.6 }); }
    S.spawnAcc = -1e9; S._elites = 1e9;                                             // no spawns during the probe
    for (let i = 0; i < 30 * 10; i++) C.step(S, { mx: (i % 60 < 30) ? 0.6 : -0.6, my: 0 });
    if (!(S.dealt > 0)) silent.push(a.key + '@' + lv);
  });
});
ok('every damaging aura deals damage at L1 and L10', silent.length === 0, silent.join(', '));

// 6. a level-10 aura out-damages its level 1 (same probe)
let weak = [];
HITTERS.forEach(a => {
  const d = [1, 10].map(lv => {
    const S = C.create(Object.assign({}, HERO, { cls: a.cls }), { seed: 5, auras: AURAS });
    S.hero.auras[a.key] = lv; S.hero.maxHp = S.hero.hp = 1e9; S._baseT = 1e9; S.spawnAcc = -1e9; S._elites = 1e9;
    for (let k = 0; k < 40; k++) { const ang = k / 40 * Math.PI * 2, dd = 1.2 + (k % 4) * 1.1; S.monsters.push({ id: S.nextId++, type: 'brute', x: Math.cos(ang) * dd, y: Math.sin(ang) * dd, hp: 1e6, maxHp: 1e6, dmg: 1, spd: 0, r: 0.6 }); }
    for (let i = 0; i < 30 * 10; i++) C.step(S, { mx: (i % 60 < 30) ? 0.6 : -0.6, my: 0 });
    return S.dealt;
  });
  if (!(d[1] > d[0])) weak.push(a.key + ' (' + Math.round(d[0]) + ' -> ' + Math.round(d[1]) + ')');
});
ok('level 10 beats level 1 for every aura', weak.length === 0, weak.join(', '));

// 6b. the trigger auras that HELP instead of hit (shield, mark, on-kill heal/speed) do their own thing, stronger at level 10
const UTIL = AURAS.filter(a => a.fam === 'trigger' && ['guard', 'heal', 'speed', 'vuln'].includes(C.fxKind(a.fx)));
ok('utility trigger auras found', UTIL.length >= 6, UTIL.length);
let noEffect = [];
UTIL.forEach(a => {
  const k = C.fxKind(a.fx), res = [1, 10].map(lv => {
    const S = C.create(Object.assign({}, HERO, { cls: a.cls }), { seed: 5, auras: AURAS });
    S.hero.auras[a.key] = lv; S.hero.maxHp = 1e6; S.hero.hp = 5e5; S.spawnAcc = -1e9; S._elites = 1e9;
    for (let q = 0; q < 12; q++) S.monsters.push({ id: S.nextId++, type: 'swarmer', x: 1 + q * 0.3, y: 0, hp: 1, maxHp: 1, dmg: 1, spd: 0, r: 0.35 });
    let best = 0;
    for (let i = 0; i < 30 * 6; i++) { C.step(S, { mx: 0, my: 0 }); const m = S.monsters.reduce((b, x) => Math.max(b, x.vuln || 0), 0);
      best = Math.max(best, k === 'guard' ? (S.hero.guard || 0) : k === 'vuln' ? m : (S.hero.hp - 5e5) + (S.hero.haste || 0) * 1000); }
    return best;
  });
  if (!(res[0] > 0 && res[1] > res[0])) noEffect.push(a.key + ' (' + res.map(x => Math.round(x * 100) / 100).join(' -> ') + ')');
});
ok('utility auras take effect and grow to level 10', noEffect.length === 0, noEffect.join(', '));

// 7. a full 30-minute Story run: the boss spawns at 30:00, and the whole run simulates in bounded time (server replay cost)
{
  const tank = Object.assign({}, HERO, { maxHp: 1e9 });                             // an immortal hero, to reach 30:00
  const S = C.create(tank, { seed: 9, mode: 'story', stage: 1, auras: AURAS });
  S.hero.hp = 1e9;
  const t0 = Date.now(); let maxMon = 0;
  for (let i = 0; i < (C.STORY_SECONDS + 5) * 30 * 3 && !S.ended && !S.bossSpawned; i++) {
    const a = S.tick * 0.004; C.step(S, S.choice ? { mx: Math.cos(a), my: Math.sin(a), pick: 0 } : { mx: Math.cos(a), my: Math.sin(a) }); maxMon = Math.max(maxMon, S.monsters.length);
  }
  const ms = Date.now() - t0;
  ok('the boss spawns at 30:00', S.bossSpawned && Math.abs(S.t - C.STORY_SECONDS) < 1, S.t);
  ok('monsters never exceed the phone cap', maxMon <= 421, maxMon);
  ok('30 simulated minutes cost under 60 s of CPU', ms < 60000, ms + ' ms');
  console.log('  30-min story sim:', ms, 'ms, peak monsters', maxMon, ', kills', S.kills, ', level', S.hero.level);
}

// 8. Survive mode scores and has no boss
const sv = botRun({ seed: 11, mode: 'survive', stage: 1 }, 30 * 90);
ok('survive scores', sv.score > 0, sv.score);
ok('survive has no boss', !sv.bossSpawned);

// 9. stage scaling: stage 10 monsters are much tougher than stage 1
ok('stage 10 >> stage 1', C.stageScale(10) > 50 * C.stageScale(1), C.stageScale(10));

// 10. the hero's own skills are buttons (Phil 24 Oct: "like a rogue likes, the player can use their skills")
const KIT = [{ key: 'mending_stitch', name: 'Mending Stitch', kind: 'heal', cd: 12, power: 0.3 },
             { key: 'reinforced_seam', name: 'Reinforced Seam', kind: 'ward', cd: 20, dur: 12 },
             { key: 'nova_t', kind: 'nova', cd: 6, power: 2 }, { key: 'bolt_t', kind: 'bolt', cd: 5, power: 3 }, { key: 'dash_t', kind: 'dash', cd: 8, power: 4 }];
const KH = Object.assign({}, HERO, { skills: KIT });
{
  const S = C.create(KH, { seed: 5, auras: AURAS });
  ok('kit has 5 slots', S.hero.kit.length === 5);
  S.hero.hp = 1000; C.step(S, { skill: 0 });
  ok('heal restores 30% max HP', Math.abs(S.hero.hp - 2200) < 1, S.hero.hp);
  ok('heal goes on cooldown', S.hero.kit[0].cdLeft > 11.9, S.hero.kit[0].cdLeft);
  S.hero.hp = 500; C.step(S, { skill: 0 });
  ok('a skill on cooldown does nothing', S.hero.hp === 500, S.hero.hp);
  const t0 = S.t; for (let i = 0; i < 30 * 40 && S.t - t0 < 12.05; i++) { S.hero.hp = 500; C.step(S, S.choice ? { pick: 0 } : {}); }   // 12 s of run time; HP held so the horde can't end it
  ok('the run is still going', !S.ended);
  const clear = () => { while (S.choice) C.step(S, { pick: 0 }); };   // a level-up pick pauses the run (and the buttons)
  clear();   ok('cooldown runs out with time', S.hero.kit[0].cdLeft === 0, S.hero.kit[0].cdLeft);
  C.step(S, { skill: 0 }); ok('usable again after the cooldown', S.hero.hp > 500);
  clear(); const x0 = S.hero.x; C.step(S, { skill: 4 }); ok('dash moves the hero', Math.abs(S.hero.x - x0 - 4) < 0.01, S.hero.x - x0);
  clear(); C.step(S, { skill: 3 }); ok('bolt fires a shot', S.shots.some(s => s.key === 'bolt_t'));
  ok('a press is recorded in the input log', S.inputs.some(e => e[1] === 's' && e[2] === 0));
  ok('an empty slot does nothing', C.useSkill(S, 7) === false);
}
{ // ward: the hero cannot drop below 1 HP while it lasts; a control without the ward dies
  function wardRun(press) {
    const S = C.create(Object.assign({}, KH, { maxHp: 40, armor: 0 }), { seed: 9, stage: 10, auras: AURAS });
    for (let i = 0; i < 30 * 10 && !S.ended; i++) C.step(S, { mx: 0, my: 0, skill: press && i === 0 ? 1 : undefined });
    return S;
  }
  const w = wardRun(true), nw = wardRun(false);
  ok('control: without the ward a 40 HP hero falls in 10 s on stage 10', nw.ended && !nw.won, nw.hero.hp);
  ok('ward (12 s): alive at 1+ HP after 10 s', !w.ended && w.hero.hp >= 1, w.hero.hp);
}
{ // replay with skill presses == live; a tampered press does not reproduce it
  function kitBot(seed, ticks) {
    const S = C.create(KH, { seed, mode: 'story', stage: 2, auras: AURAS });
    for (let i = 0; i < ticks && !S.ended; i++) { const a = S.tick * 0.004;
      if (S.choice) { C.step(S, { mx: Math.cos(a), my: Math.sin(a), pick: 0 }); continue; }
      const ready = S.hero.kit.findIndex(k => k.cdLeft === 0);
      C.step(S, { mx: Math.cos(a), my: Math.sin(a), skill: ready >= 0 && i % 7 === 0 ? ready : undefined }); }
    return S;
  }
  const L = kitBot(77, 30 * 120), R = C.replay(KH, { seed: 77, mode: 'story', stage: 2, auras: AURAS }, L.inputs, L.tick);
  ok('replay with skill presses == live run', C.digest(R) === C.digest(L), C.digest(R) + ' vs ' + C.digest(L));
  ok('the bot really pressed skills', L.inputs.filter(e => e[1] === 's').length > 10, L.inputs.filter(e => e[1] === 's').length);
  const bad2 = L.inputs.map(e => e.slice()), si = bad2.findIndex(e => e[1] === 's' && e[2] === 2); if (si >= 0) bad2[si][2] = 4;
  ok('control: a tampered skill press does not reproduce the run', si >= 0 && C.digest(C.replay(KH, { seed: 77, mode: 'story', stage: 2, auras: AURAS }, bad2, L.tick)) !== C.digest(L));
}

console.log(fail ? `test_survivors_core: ${pass} passed, ${fail} FAILED` : `test_survivors_core: ${pass} checks passed`);
process.exit(fail ? 1 : 0);
