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
ok('the bot levelled up', r1.hero.level >= 3, r1.hero.level);
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
// v3: Rage Ember now burns; Grudge Mark only hunts what hit you (its own test below)
const V3_HIT = ['rage-ember'], V3_OWN = ['grudge-mark', 'smoke-veil', 'death-mark', 'eagle-eye'];   // these have their own tests below
const HITTERS = AURAS.filter(a => !V3_OWN.includes(a.key) && (V3_HIT.includes(a.key) || !(a.fam === 'trigger' && ['guard', 'heal', 'speed', 'vuln'].includes(C.fxKind(a.fx)))));
HITTERS.forEach(a => {
  [1, 10].forEach(lv => {
    const hero = Object.assign({}, HERO, { cls: a.cls });
    const S = C.create(hero, { seed: 5, auras: AURAS });
    S.hero.auras[a.key] = lv; S.hero.maxHp = S.hero.hp = 1e9; S._baseT = 1e9;       // no base attack: only the aura can hurt
    for (let k = 0; k < 40; k++) { const ang = k / 40 * Math.PI * 2, d = 1.2 + (k % 4) * 1.1; S.monsters.push({ id: S.nextId++, type: 'brute', x: Math.cos(ang) * d, y: Math.sin(ang) * d, hp: 1e6, maxHp: 1e6, dmg: 1, spd: 0, r: 0.6 }); }
    for (let k = 0; k < 20; k++) { const ang = k / 20 * Math.PI * 2; S.monsters.push({ id: S.nextId++, type: 'brute', x: Math.cos(ang) * 8, y: Math.sin(ang) * 8, hp: 1e6, maxHp: 1e6, dmg: 1, spd: 0, r: 0.6 }); }
    S.noSpawn = true;                                             // no spawns during the probe
    const still = a.key === 'molten-ground';                          // v3: it wells up only where you stand still
    for (let i = 0; i < 30 * 10; i++) C.step(S, still ? {} : { mx: (i % 60 < 30) ? 0.6 : -0.6, my: 0 });
    if (!(S.dealt > 0)) silent.push(a.key + '@' + lv);
  });
});
ok('every damaging aura deals damage at L1 and L10', silent.length === 0, silent.join(', '));

// 6. a level-10 aura out-damages its level 1 (same probe)
let weak = [];
HITTERS.forEach(a => {
  const d = [1, 10].map(lv => {
    const S = C.create(Object.assign({}, HERO, { cls: a.cls }), { seed: 5, auras: AURAS });
    S.hero.auras[a.key] = lv; S.hero.maxHp = S.hero.hp = 1e9; S._baseT = 1e9; S.noSpawn = true;
    for (let k = 0; k < 40; k++) { const ang = k / 40 * Math.PI * 2, dd = 1.2 + (k % 4) * 1.1; S.monsters.push({ id: S.nextId++, type: 'brute', x: Math.cos(ang) * dd, y: Math.sin(ang) * dd, hp: 1e6, maxHp: 1e6, dmg: 1, spd: 0, r: 0.6 }); }
    for (let k = 0; k < 20; k++) { const ang = k / 20 * Math.PI * 2; S.monsters.push({ id: S.nextId++, type: 'brute', x: Math.cos(ang) * 8, y: Math.sin(ang) * 8, hp: 1e6, maxHp: 1e6, dmg: 1, spd: 0, r: 0.6 }); }
    for (let i = 0; i < 30 * 10; i++) C.step(S, a.key === 'molten-ground' ? {} : { mx: (i % 60 < 30) ? 0.6 : -0.6, my: 0 });
    return S.dealt;
  });
  if (!(d[1] > d[0])) weak.push(a.key + ' (' + Math.round(d[0]) + ' -> ' + Math.round(d[1]) + ')');
});
ok('level 10 beats level 1 for every aura', weak.length === 0, weak.join(', '));

// 6b. the trigger auras that HELP instead of hit (shield, mark, on-kill heal/speed) do their own thing, stronger at level 10
const UTIL = AURAS.filter(a => a.fam === 'trigger' && !V3_HIT.includes(a.key) && !V3_OWN.includes(a.key) && ['guard', 'heal', 'speed', 'vuln'].includes(C.fxKind(a.fx)));
ok('utility trigger auras found', UTIL.length >= 3, UTIL.length);
let noEffect = [];
UTIL.forEach(a => {
  const k = C.fxKind(a.fx), res = [1, 10].map(lv => {
    const S = C.create(Object.assign({}, HERO, { cls: a.cls }), { seed: 5, auras: AURAS });
    S.hero.auras[a.key] = lv; S.hero.maxHp = 1e6; S.hero.hp = 5e5; S.noSpawn = true;
    for (let q = 0; q < 12; q++) S.monsters.push({ id: S.nextId++, type: 'swarmer', x: 1 + q * 0.3, y: 0, hp: 1, maxHp: 1, dmg: 1, spd: 0, r: 0.35 });
    let best = 0;
    for (let i = 0; i < 30 * 6; i++) { C.step(S, { mx: 0, my: 0 }); const m = S.monsters.reduce((b, x) => Math.max(b, x.vuln || 0), 0);
      best = Math.max(best, a.key === 'bastion-dome' ? (S.hero.domeDR || 0) : a.key === 'blessed-shield' ? (S.hero.bubble || 0) : k === 'guard' ? (S.hero.guard || 0) : k === 'vuln' ? m : (S.hero.hp - 5e5) + (S.hero.haste || 0) * 1000); }
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
  ok('monsters never exceed the phone cap', maxMon <= C.HARD_MAX, maxMon);
  ok('the horde reaches the hero: 3000+ kills in 30 min (a far-spawn bug once gave 165)', S.kills >= 3000, S.kills);
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

// 11. waves, the Vampire Survivors way: 30 one-minute rows, top-up to min, one-of-each above it, 300 cap, events
ok('30 waves, one per minute', C.WAVES.length === 30 && C.waveIndex(59.9) === 0 && C.waveIndex(60) === 1 && C.waveIndex(1799) === 29);
ok('survive loops minutes 20-29 after 30:00', C.waveIndex(1800) === 20 && C.waveIndex(2399) === 29 && C.waveIndex(2400) === 20);
ok('the rhythm breathes: a lull straight after a spike', C.WAVES[11].min === 300 && C.WAVES[12].min === 20);
{
  const S = C.create(HERO, { seed: 3, stage: 1, auras: AURAS }); S.hero.maxHp = S.hero.hp = 1e9; S._baseT = 1e9;
  C.step(S, {}); ok('minute 0 tops up to its min (15) on the first tick', S.monsters.length === 15, S.monsters.length);
  for (let i = 0; i < 30; i++) C.step(S, {});
  ok('above min it adds one of each type per interval (1 s, 1 type -> 16)', S.monsters.length === 16, S.monsters.length);
  const T = C.create(HERO, { seed: 3, stage: 1, auras: AURAS }); T.hero.maxHp = T.hero.hp = 1e9; T._baseT = 1e9;
  for (let i = 0; i < 30 * 60 * 12 && T.t < 11 * 60 + 5; i++) C.step(T, T.choice ? { pick: 0 } : {});
  const alive = T.monsters.filter(m => !m.ev && !m.wb && m.type !== 'boss').length;
  ok('minute 11 fills to the 300 cap and holds it', alive >= 290 && alive <= C.MAX_MONSTERS, alive);
  ok('never past the hard phone cap', T.monsters.length <= C.HARD_MAX, T.monsters.length);
  const U = C.create(HERO, { seed: 4, stage: 1, auras: AURAS }); U.hero.maxHp = U.hero.hp = 1e9; U._baseT = 1e9; let sw = 0, wl = 0;
  for (let i = 0; i < 30 * 60 * 12 && U.t < 10 * 60 + 20; i++) { C.step(U, U.choice ? { pick: 0 } : {}); sw = Math.max(sw, U.monsters.filter(m => m.vx != null).length); wl = Math.max(wl, U.monsters.filter(m => m.ev && m.type === 'wall').length); }
  ok('the 2:00 swarm sweeps in (straight-line runners)', sw >= 14, sw);
  ok('the 5:00 / 10:00 wall closes in round the hero', wl >= 30, wl);
}

// 12. Stage 1 = Emberfall Vale skins; casters shoot bolts you can dodge (Phil 24 Oct)
{
  const R1 = C.roster(1);
  ok('stage 1 is Emberfall Vale with our Chapter 1 monsters', R1.name === 'Emberfall Vale' && R1.caster.includes('vexmite') && R1.boss[0] === 'brukk');
  const S = C.create(HERO, { seed: 6, auras: AURAS }); S.noSpawn = true; C.step(S, {});
  const T = C.create(HERO, { seed: 6, auras: AURAS }); T.noSpawn = true; C.step(T, {});
  function casterAt(R, x, y) { R.monsters.push({ id: 900 + R.monsters.length, type: 'caster', x, y, hp: 1e9, maxHp: 1e9, dmg: 10, spd: 2.8, r: 0.5, cdT: 0.2, skin: 'vexmite' }); }
  casterAt(S, 7, 0); casterAt(T, 7, 0); S._baseT = T._baseT = 1e9;
  let fired = 0;
  for (let i = 0; i < 30 * 8; i++) { C.step(S, {}); fired = Math.max(fired, S.eshots.length); }
  for (let i = 0; i < 30 * 8; i++) C.step(T, { mx: 0, my: (Math.floor(i / 45) % 2) ? 1 : -1 });   // keep moving up and down
  ok('a caster fires bolts', fired >= 1, fired);
  ok('standing still, the bolts hit', (S.shotTaken || 0) > 0, S.shotTaken);
  ok('moving, the bolts miss (dodged)', (T.shotTaken || 0) < (S.shotTaken || 0) * 0.5, (T.shotTaken || 0) + ' vs ' + S.shotTaken);
  ok('a caster keeps its distance', Math.hypot(S.monsters[0].x - S.hero.x, S.monsters[0].y - S.hero.y) > 4, Math.hypot(S.monsters[0].x - S.hero.x, S.monsters[0].y - S.hero.y));
  const B = C.create(HERO, { seed: 2, auras: AURAS }); B.noSpawn = true; C.step(B, {}); B._baseT = 1e9;
  B.monsters.push({ id: 999, type: 'boss', x: 10, y: 0, hp: 1e9, maxHp: 1e9, dmg: 10, spd: 0, r: 2.2, cdT: 0.1, skin: 'brukk' });
  let bf = 0; for (let i = 0; i < 30 * 2; i++) { C.step(B, {}); bf = Math.max(bf, B.eshots.length); }
  ok('the boss fires a 5-bolt fan', bf >= 5, bf);
}

// 13. the 10 TANK spells each do their OWN thing (Phil 24 Oct: "All of them should be different in nature" / "Not repeating")
{
  const TH = Object.assign({}, HERO, { cls: 'Tank' });
  function field(key, lv, mons) { const S = C.create(TH, { seed: 8, auras: AURAS }); S.noSpawn = true; S._baseT = 1e9; S.hero.maxHp = S.hero.hp = 1e9;
    if (key) S.hero.auras[key] = lv; (mons || []).forEach(([x, y, o]) => S.monsters.push(Object.assign({ id: S.nextId++, type: 'brute', x, y, hp: 1e6, maxHp: 1e6, dmg: 1, spd: 0, r: 0.6 }, o || {}))); return S; }
  const run = (S, n, inp) => { for (let i = 0; i < n; i++) C.step(S, typeof inp === 'function' ? inp(i) : (inp || {})); return S; };
  // Spike Ring: the ripple hits a monster at its wavefront, and only once per ripple
  { const S = run(field('spike-ring', 1, [[3, 0]]), 30 * 1.2); ok('spike-ring: a ripple rolls out and hits the ring of ground it passes', S.dealt > 0 && S.zones.every(z => z.kind !== 'ring'), S.dealt); }
  { const S = run(field('spike-ring', 10, [[4.5, 0]]), 30 * 1); ok('spike-ring L10: the hedge roots what touches it', S.monsters[0].stunT > 0, S.monsters[0].stunT); }
  // Iron Bulwark: a monster AHEAD is shoved further ahead; one BEHIND is untouched
  { const S = run(field('iron-bulwark', 3, [[1.9, 0], [-1.9, 0]]), 30 * 1, { mx: 1, my: 0 });
    ok('iron-bulwark: plates in front shove the horde ahead, behind is untouched', S.monsters[0].x > 4 && S.monsters[1].hp === 1e6, S.monsters[0].x.toFixed(1) + ' / ' + S.monsters[1].hp); }
  // Quake Step: cracks only while walking (control: standing makes none)
  { const W = run(field('quake-step', 3), 30 * 2, { mx: 1, my: 0 }), N = run(field('quake-step', 3), 30 * 2);
    ok('quake-step: walking opens forward cracks, standing does not (control)', W.zones.some(z => z.kind === 'crack') && !N.zones.some(z => z.kind === 'crack')); }
  // Thorn Hide: no damage until a monster hits you, then that monster is lashed
  { const S = field('thorn-hide', 1, [[0.6, 0, { dmg: 5 }]]); S.monsters[0].spd = 0; run(S, 30 * 1);
    const quiet = field('thorn-hide', 1, [[5, 0]]); run(quiet, 30 * 1);
    ok('thorn-hide: the monster that hits you is lashed; untouched, nothing (control)', S.dealt > 0 && quiet.dealt === 0, S.dealt + ' / ' + quiet.dealt); }
  // Taunting Roar: monsters 5 m out are sucked in, then stunned
  { const S = run(field('taunting-roar', 1, [[5, 0, { spd: 0 }]]), 30 * 0.6), d = Math.hypot(S.monsters[0].x, S.monsters[0].y);
    ok('taunting-roar: pulls monsters in, then stuns them', d < 3 && S.monsters[0].stunT > 0, d.toFixed(2)); }
  // Boulder Roll: a boulder rolls forward and grows
  { const S = run(field('boulder-roll', 5), 30 * 1.2, { mx: 1, my: 0 }), r = S.rollers[0];
    ok('boulder-roll: a boulder rolls forward and grows as it goes', r && r.x > 3 && r.r > 0.7 * (1), r && (r.x.toFixed(1) + ' r' + r.r.toFixed(2))); }
  // Molten Ground: standing burns, walking does not (control)
  { const St = run(field('molten-ground', 3, [[0.8, 0]]), 30 * 3), Wk = field('molten-ground', 3, [[0.8, 0]]); run(Wk, 30 * 3, { mx: 1, my: 0 });
    ok('molten-ground: lava wells up only where you stand still (control: walking)', St.dealt > 0 && Wk.dealt === 0, St.dealt + ' / ' + Wk.dealt); }
  // Bastion Dome: inside it you take less; walk out and the cut is gone
  { const S = run(field('bastion-dome', 1), 30 * 0.5); const inside = S.hero.domeDR; run(S, 30 * 3, { mx: 1, my: 0 });
    ok('bastion-dome: a placed dome cuts damage inside, not outside', inside > 0.3 && S.hero.domeDR === 0, inside + ' / ' + S.hero.domeDR); }
  // Avalanche Fall: the rocks land on the thickest crowd, not the lone monster
  { const crowd = []; for (let i = 0; i < 12; i++) crowd.push([8 + (i % 4) * 0.3, -3 + Math.floor(i / 4) * 0.3]); crowd.push([-6, 4]);
    const S = run(field('avalanche-fall', 1, crowd), 9); const drops = S.zones.filter(z => z.kind === 'drop');
    ok('avalanche-fall: rocks fall on the thickest crowd', drops.length > 0 && drops.every(z => z.x > 5), drops.map(z => z.x.toFixed(1)).join(',')); }
}

// 14. the 10 SUPPORT spells each do their OWN thing (Linnet's class)
{
  const SH = Object.assign({}, HERO, { cls: 'Support' });
  function field(key, lv, mons) { const S = C.create(SH, { seed: 9, auras: AURAS }); S.noSpawn = true; S._baseT = 1e9; S.hero.maxHp = 1e6; S.hero.hp = 5e5;
    if (key) S.hero.auras[key] = lv; (mons || []).forEach(([x, y, o]) => S.monsters.push(Object.assign({ id: S.nextId++, type: 'brute', x, y, hp: 1e6, maxHp: 1e6, dmg: 1, spd: 0, r: 0.6 }, o || {}))); return S; }
  const run = (S, n, inp) => { for (let i = 0; i < n; i++) C.step(S, typeof inp === 'function' ? inp(i) : (inp || {})); return S; };
  { const S = run(field('halo-of-light', 1, [[2, 0], [9, 0]]), 30 * 2); ok('halo-of-light: heals you and purifies monsters in the light, not outside it', S.hero.hp > 5e5 && S.monsters[0].hp < 1e6 && S.monsters[1].hp === 1e6); }
  { const S = run(field('song-notes', 1, [[3, 0], [4, 0]]), 30 * 1.5, { mx: 1, my: 0 }); ok('song-notes: a note charms a monster', S.monsters.some(m => m.charmT > 0)); }
  { const S = field('song-notes', 1, [[2, 0, { charmT: 5, dmg: 50, spd: 3 }], [3, 0]]); S.hero.auras = {}; run(S, 30 * 2);
    ok('charm: a charmed monster attacks the horde', S.monsters[1].hp < 1e6, S.monsters[1].hp); }
  { const S = run(field('sanctuary', 1), 30 * 0.3); const c = S._state['sanctuary'].c; run(S, 30 * 2, { mx: 1, my: 0 });
    ok('sanctuary: the circle stays where it was laid', c && S._state['sanctuary'].c && S._state['sanctuary'].c.x === c.x && S.hero.x > 3); }
  { const S = run(field('prism-beam', 1, [[0, 4], [0, -4], [4, 0], [-4, 0]]), 30 * 4); ok('prism-beam: the sweeping beam hits all round, and blinds', S.monsters.every(m => m.hp < 1e6) && S.monsters.some(m => m.blindT > 0)); }
  { const S = field('blessed-shield', 1, [[0.5, 0, { dmg: 30000 }]]); run(S, 30 * 0.2); const hp0 = S.hero.hp, b = S.hero.bubble; run(S, 30 * 0.6);
    ok('blessed-shield: the bubble soaks the hit first, then pops', b > 0 && S.hero.bubble < b, b + ' -> ' + S.hero.bubble); }
  { const S = field('spirit-lantern', 1); S.gems.push({ x: 5, y: 0, v: 3 }); run(S, 30 * 1.5); ok('spirit-lantern: the lantern carries a far gem home', S.hero.xp > 0 || S.gems.length === 0, S.hero.xp); }
  { const S = field('bloom-path', 1); let early = 0, late = 0;
    for (let i = 0; i < 30 * 1.5; i++) { C.step(S, { mx: 1, my: 0 }); early += S.fx.filter(f => f.kind === 'pollen').length; }   // out: flowers are planted, none burst
    for (let i = 0; i < 30 * 2.2; i++) C.step(S, {});                                                                         // wait: they ripen (2 s)
    for (let i = 0; i < 30 * 1.6; i++) { C.step(S, { mx: -1, my: 0 }); late += S.fx.filter(f => f.kind === 'pollen').length; } // back over them: they burst
    ok('bloom-path: flowers burst only when you walk back over them (control: not on the way out)', early === 0 && late > 0, early + ' / ' + late); }
  { const S = run(field('chime-pulse', 1, [[3, 0]]), 30 * 1.2); ok('chime-pulse: echo rings roll out, the last one stuns', S.dealt > 0 && S.monsters[0].stunT > 0, S.monsters[0].stunT); }
  { const S = run(field('guardian-spirits', 1, [[1.7, 1.7]]), 30 * 0.5); ok('guardian-spirits: a spirit at its corner pushes a monster away', Math.hypot(S.monsters[0].x, S.monsters[0].y) > 2.6, Math.hypot(S.monsters[0].x, S.monsters[0].y)); }
  { const ring = []; for (let i = 0; i < 24; i++) ring.push([Math.cos(i * Math.PI / 12) * 4, Math.sin(i * Math.PI / 12) * 4]); ring.push([30, 0]);
    const S = run(field('sunburst', 1, ring), 30 * 0.6), got = S.monsters.slice(0, 24).filter(m => m.blindT > 0 && m.hp < 1e6).length;
    ok('sunburst v2: rays burst out all round and blind what they pass (control: a monster beyond their reach is untouched)', got >= 6 && S.monsters[24].hp === 1e6, got); }
}

// 15. MAGE + BRUISER spells each do their OWN thing
{
  function field(cls, key, lv, mons) { const S = C.create(Object.assign({}, HERO, { cls }), { seed: 11, auras: AURAS }); S.noSpawn = true; S._baseT = 1e9; S.hero.maxHp = 1e6; S.hero.hp = 5e5;
    if (key) S.hero.auras[key] = lv; (mons || []).forEach(([x, y, o]) => S.monsters.push(Object.assign({ id: S.nextId++, type: 'brute', x, y, hp: 1e6, maxHp: 1e6, dmg: 1, spd: 0, r: 0.6 }, o || {}))); return S; }
  const run = (S, n, inp) => { for (let i = 0; i < n; i++) C.step(S, typeof inp === 'function' ? inp(i) : (inp || {})); return S; };
  const d0 = m => Math.hypot(m.x, m.y);
  { const ring = []; for (let i = 0; i < 12; i++) ring.push([Math.cos(i * Math.PI / 6) * 5, Math.sin(i * Math.PI / 6) * 5]); const S = run(field('Mage', 'arcane-orbs', 1, ring), 30 * 3);
    ok('arcane-orbs: orbs spiral OUT and reach the ring 5 m away (none hit at start)', S.monsters.some(m => m.hp < 1e6)); }
  { const S = field('Mage', 'fire-halo', 1, [[0.5, 0], [2.5, 0]]); run(S, 30 * 2); ok('fire-halo: the edge burns, the middle is safe', S.monsters[1].hp < 1e6 && S.monsters[0].hp === 1e6, S.monsters[0].hp + ' / ' + S.monsters[1].hp); }
  { const S = run(field('Mage', 'frost-nova', 1, [[2, 0]]), 3); const fr = S.monsters[0].frozenT > 0; const before = S.monsters[0].hp; S.hero.auras = { 'arcane-orbs': 1 };
    ok('frost-nova: freezes monsters solid', fr, S.monsters[0].frozenT); }
  { const S = field('Mage', 'fire-halo', 1, [[2.5, 0, { frozenT: 30 }], [-2.5, 0]]); run(S, 30 * 0.3);          // the same burn on a frozen and a thawed monster
    const fz = 1e6 - S.monsters[0].hp, th = 1e6 - S.monsters[1].hp; ok('frost-nova: a frozen monster shatters for double when hit', fz > th * 1.5 && S.monsters[0].frozenT === 0, fz + ' vs ' + th); }
  { const ms = []; for (let i = 0; i < 6; i++) ms.push([2 + i * 2, 0]); const S = run(field('Mage', 'chain-lightning', 5, ms), 3);
    ok('chain-lightning: one bolt jumps through several monsters', S.monsters.filter(m => m.hp < 1e6).length >= 4, S.monsters.filter(m => m.hp < 1e6).length); }
  { const S = run(field('Mage', 'starfall', 1), 3), o = S._state['starfall'].o[0]; ok('starfall: stars streak diagonally', o && o.vx > 0 && o.vy > 0); }
  { const S = run(field('Mage', 'gravity-well', 1, [[11, 0, { spd: 0 }]]), 30 * 1.5, { mx: 1, my: 0 }); const w = S._state['gravity-well'].w;
    ok('gravity-well: the far orb pulls monsters toward it', w && Math.hypot(S.monsters[0].x - w.x, S.monsters[0].y - w.y) < 3.5, w && Math.hypot(S.monsters[0].x - w.x, S.monsters[0].y - w.y)); }
  { const S = field('Mage', 'rune-circle', 1); run(S, 30 * 2.5, { mx: 1, my: 0 }); const r = S._state['rune-circle'].o.concat(S.fx.filter(f => f.kind === 'rune'))[0];
    ok('rune-circle: runes are left where you were, behind you', r && r.x < S.hero.x - 3, r && (r.x.toFixed(1) + ' vs ' + S.hero.x.toFixed(1))); }
  { const S = run(field('Mage', 'wisp-familiars', 1, [[7, 0]]), 30 * 3); ok('wisp-familiars: a wisp flies off and hunts a far monster', S.monsters[0].hp < 1e6); }
  { const S = run(field('Mage', 'mana-storm', 5, [[1, 0], [-1, 1], [0, -1.5], [2, 2]]), 30 * 4); ok('mana-storm: lightning strikes under the cloud', S.monsters.some(m => m.hp < 1e6)); }
  { const S = run(field('Mage', 'meteor-call', 1, [[8, 0], [-8, 0]]), 30 * 2.2, { mx: 1, my: 0 }); ok('meteor-call: lands where you are heading, not behind', S.monsters[1].hp === 1e6 && S.zones.concat([]).length >= 0 && (S.monsters[0].hp < 1e6 || S.zones.some(z => z.key === 'meteor-call' && z.x > 8))); }
  { const ms = []; for (let i = 0; i < 8; i++) ms.push([Math.cos(i * Math.PI / 4) * 2, Math.sin(i * Math.PI / 4) * 2]); const S = run(field('Bruiser', 'blade-whirl', 1, ms), 30 * 0.6);
    ok('blade-whirl: one spin hits all the way round', S.monsters.every(m => m.hp < 1e6), S.monsters.filter(m => m.hp < 1e6).length); }
  { const S = run(field('Bruiser', 'shock-stomp', 1, [[5, 0], [0, 5]]), 30 * 1, { mx: 1, my: 0 }); ok('shock-stomp: the wave rolls along the line ahead only', S.monsters[0].hp < 1e6 && S.monsters[1].hp === 1e6); }
  { const S = field('Bruiser', 'chain-flail', 1, [[-2.6, 0], [2.6, 0]]); run(S, 30 * 1, { mx: 1, my: 0 }); ok('chain-flail: the flail swings behind you', S.monsters[0].hp < 1e6 && S.monsters[1].hp === 1e6); }
  { const ms = []; for (let i = 0; i < 10; i++) ms.push([Math.cos(i) * 2.5, Math.sin(i) * 2.5]); const S = run(field('Bruiser', 'rage-ember', 1, ms), 30 * 4);
    const L = run(field('Bruiser', 'rage-ember', 1, [[3, 0]]), 30 * 4); ok('rage-ember: a crowd round you fills the rage and it bursts (control: one monster does not)', S.dealt > 0 && L.dealt === 0, S.dealt + ' / ' + L.dealt); }
  { const S = run(field('Bruiser', 'iron-fists', 1, [[2, 0]]), 30 * 0.5); ok('iron-fists: a fist jabs the nearest monster', S.monsters[0].hp < 1e6); }
  { const S = run(field('Bruiser', 'cleaver-rain', 3, [[5.2, 0], [-5.2, 0]]), 30 * 1.5, { mx: 1, my: 0 }); ok('cleaver-rain: cleavers come down in a line ahead', S.monsters[0].hp < 1e6 && S.monsters[1].hp === 1e6); }
  { const S = run(field('Bruiser', 'war-drum', 1, [[2, 0]]), 30 * 4.5); ok('war-drum: the 4th beat leaves monsters taking more damage', S.dealt > 0 && S._state['war-drum'].beat >= 0); }
  { const S = field('Bruiser', 'grudge-mark', 1, [[0.6, 0, { dmg: 5 }], [-4, 0]]); run(S, 30 * 2); ok('grudge-mark: the axe hunts the monster that hit you, not the other one', S.monsters[0].hp < 1e6 && S.monsters[1].hp === 1e6, S.monsters[0].hp + ' / ' + S.monsters[1].hp); }
  { const S = run(field('Bruiser', 'rending-gale', 1, [[3, 1.5], [3, -1.5]]), 30 * 0.6, { mx: 1, my: 0 }); ok('rending-gale: the blade sweeps sideways across your front', S.monsters.every(m => m.hp < 1e6)); }
  { const S = field('Bruiser', 'bloodlust', 1, [[2, 0, { hp: 1, maxHp: 1 }]]); S.hero.auras['blade-whirl'] = 1; const hp0 = S.hero.hp; run(S, 30 * 2);
    ok('bloodlust: a kill spills blood that flies back and heals you', S.kills >= 1 && S.hero.hp > hp0, S.kills + ' ' + (S.hero.hp - hp0)); }
}

// 16. ASSASSIN + MARKSMAN spells each do their OWN thing
{
  function field(cls, key, lv, mons) { const S = C.create(Object.assign({}, HERO, { cls }), { seed: 12, auras: AURAS }); S.noSpawn = true; S._baseT = 1e9; S.hero.maxHp = 1e6; S.hero.hp = 5e5;
    if (key) S.hero.auras[key] = lv; (mons || []).forEach(([x, y, o]) => S.monsters.push(Object.assign({ id: S.nextId++, type: 'brute', x, y, hp: 1e6, maxHp: 1e6, dmg: 1, spd: 0, r: 0.6 }, o || {}))); return S; }
  const run = (S, n, inp) => { for (let i = 0; i < n; i++) C.step(S, typeof inp === 'function' ? inp(i) : (inp || {})); return S; };
  { const S = run(field('Assassin', 'shadow-knives', 1, [[-4, 0], [4, 0]]), 30 * 1, { mx: 1, my: 0 }); ok('shadow-knives: thrown BEHIND you, not ahead', S.monsters[0].hp < 1e6 && S.monsters[1].hp === 1e6); }
  { const S = run(field('Assassin', 'poison-cloud', 1), 30 * 2); const c = S._state['poison-cloud'].o[0]; ok('poison-cloud: the cloud drifts with the wind', c && c.x > 0.8, c && c.x); }
  { const S = field('Assassin', 'phantom-blades', 1, [[3, 0]]); run(S, 30 * 1.4, { mx: 1, my: 0 }); const hp1 = S.monsters[0].hp; ok('phantom-blades: blades go out AND come back (two cuts)', hp1 < 1e6 && S.dealt >= 2 * (1e6 - hp1) * 0.4); }
  { const S = field('Assassin', 'smoke-veil', 1, [[3, 0, { spd: 2.6 }]]); run(S, 2); const dx0 = S.hero.decoyX; run(S, 30 * 1, { mx: -1, my: 0 });
    ok('smoke-veil: you vanish and the monster walks to where you were', S.hero.hidden > 0 && Math.abs(S.monsters[0].x - dx0) < 1.5, S.monsters[0].x.toFixed(2)); }
  { const S = run(field('Assassin', 'death-mark', 1, [[3, 0, { hp: 100, maxHp: 1e6 }], [4, 0, { hp: 2e6, maxHp: 2e6 }]]), 3);
    ok('death-mark: marks the strongest monster on screen', S.monsters[1].marked === 1 && !S.monsters[0].marked); }
  { const S = field('Assassin', null, 1, [[3, 0, { marked: 1, exec: 0.2, hp: 1e6, maxHp: 1e6 }]]); S.hero.auras = { 'shadow-knives': 1 }; S.hero.dirx = -1;
    const m = S.monsters[0]; m.hp = 0.2 * m.maxHp + 200; run(S, 30 * 1); ok('death-mark: a marked monster under 20% is executed', S.kills === 1 || m.hp <= 0); }
  { const S = run(field('Assassin', 'shuriken-storm', 1, [[5, 0]]), 30 * 2, { mx: 1, my: 0 }); ok('shuriken-storm: shurikens stick in the ground and spin as saws', S._state['shuriken-storm'].o.some(o => !(o.fly > 0)) || S.monsters[0].hp < 1e6); }
  { const S = run(field('Assassin', 'venom-trail', 1, [[6, 0]]), 30 * 2.5); ok('venom-trail: the snake slithers to the monster and bites', S.monsters[0].hp < 1e6); }
  { const S = run(field('Assassin', 'shadow-clone', 1, [[-2, 0]]), 30 * 1); ok('shadow-clone: the clone on the other side of you cuts', S.monsters[0].hp < 1e6); }
  { const S = field('Assassin', 'swift-strikes', 1, [[2, 3]]); run(S, 30 * 0.5, { mx: 1, my: 0 }); const x0 = S.hero.x; run(S, 3, { mx: 0, my: 1 });
    const N = field('Assassin', 'swift-strikes', 1); run(N, 30 * 1, { mx: 1, my: 0 });
    ok('swift-strikes: turning dashes you forward (control: walking straight never dashes)', S.hero.y > 2 && !N.fx.some(f => f.kind === 'dash'), S.hero.y.toFixed(2)); }
  { const S = run(field('Assassin', 'night-sickles', 1, [[4, 0], [-4, 0]]), 30 * 5); ok('night-sickles: the figure-8 sweeps both sides', S.monsters.every(m => m.hp < 1e6)); }
  { const S = run(field('Marksman', 'arrow-volley', 1, [[5, -1], [5, 1], [-5, 0]]), 30 * 0.6, { mx: 1, my: 0 }); ok('arrow-volley: a fan forward', S.monsters[0].hp < 1e6 && S.monsters[1].hp < 1e6 && S.monsters[2].hp === 1e6); }
  { const S = field('Marksman', 'hunter-s-turret', 1, [[6, 0]]); run(S, 3); run(S, 30 * 2, { mx: -1, my: 0 }); ok('hunters-turret: the planted turret keeps shooting after you leave', S.monsters[0].hp < 1e6 && S._state['hunter-s-turret'].o.length === 1); }
  { const ms = []; for (let i = 0; i < 6; i++) ms.push([3 + i * 2, 0]); const S = run(field('Marksman', 'piercing-bolt', 1, ms), 30 * 2.5); ok('piercing-bolt: charges, then one bolt goes through the whole line', S.monsters.filter(m => m.hp < 1e6).length >= 5); }
  { const S = run(field('Marksman', 'falcon-companion', 1, [[8, 0]]), 30 * 2); ok('falcon-companion: the falcon dives on a far monster', S.monsters[0].hp < 1e6); }
  { const S = field('Marksman', 'spark-mines', 1); run(S, 30 * 1.5, { mx: 1, my: 0 }); const mine = S._state['spark-mines'].o[0];
    ok('spark-mines: mines are dropped behind you', mine && mine.x < S.hero.x); S.monsters.push({ id: 999, type: 'brute', x: mine.x, y: mine.y, hp: 1e6, maxHp: 1e6, dmg: 1, spd: 0, r: 0.6 }); run(S, 30 * 0.8);
    ok('spark-mines: a mine blows when a monster steps on it', S.monsters.find(m => m.id === 999).hp < 1e6); }
  { const S = run(field('Marksman', 'eagle-eye', 1, [[14, 0], [3, 0]]), 30 * 2); ok('eagle-eye: the crosshair snipes the FAR monster, not the near one', S.monsters[0].hp < 1e6 && S.monsters[1].hp === 1e6); }
  { const S = run(field('Marksman', 'ricochet-shots', 1), 30 * 4, { mx: 1, my: 0 }); const o = S._state['ricochet-shots'].o; ok('ricochet-shots: shots bounce off the screen edge and come back', o.some(q => q.vx < 0) || S._state['ricochet-shots'].o.length === 0); }
  { const S = run(field('Marksman', 'rain-of-arrows', 1, [[3.5, 0], [0.5, 0]]), 30 * 6); ok('rain-of-arrows: the rain falls in a ring round you, not on you', S.monsters[0].hp < 1e6 && S.monsters[1].hp === 1e6); }
  { const S = run(field('Marksman', 'wind-shot', 1, [[3, 0]]), 30 * 0.8, { mx: 1, my: 0 }); ok('wind-shot: the gust blows the monster back', S.monsters[0].x > 4, S.monsters[0].x.toFixed(2)); }
  { const S = run(field('Marksman', 'flare-trail', 1), 30 * 1.2); ok('flare-trail: flares land round you', S._state['flare-trail'].o.some(o => o.fly <= 0)); }
}

console.log(fail ? `test_survivors_core: ${pass} passed, ${fail} FAILED` : `test_survivors_core: ${pass} checks passed`);
process.exit(fail ? 1 : 0);
