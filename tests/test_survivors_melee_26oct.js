// test_survivors_melee_26oct.js - Phil 26 Oct: "Melee heroes in game should swing their weapon, punch, or stab" (not a projectile),
// and "These spells should be class specific". The Swarm Spire core: a melee hero swings (no basic-attack shots), the blow lands at
// 0.45 s on monsters in a 120-degree arc in front and inside its reach, never behind it; a ranged hero still shoots; the level-up
// passives on offer are the hero's own class only.
const assert = require('assert'); const C = require('../server/survivors-core.js');
const AURAS = require('../server/survivors-auras.json'); let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok   ' + m); };
const rows = Array.isArray(AURAS) ? AURAS : AURAS.auras;
function run(hero, steps, each) { const S = C.create(Object.assign({ key: 't', maxHp: 1e6, atk: 100, skills: [] }, hero), { seed: 7, auras: rows });
  for (let i = 0; i < steps; i++) { C.step(S, {}); S.choice = null; S.hero.hp = S.hero.maxHp; each && each(S); } return S; }

// 1. melee: swings, no shots
{ let shots = 0, swings = 0; const seen = new Set();
  const S = run({ cls: 'Bruiser', melee: true, reach: 2.2 }, 900, S => { S.shots.forEach(s => { if (s.key === '_base' && !seen.has(s)) { seen.add(s); shots++; } });
    S.fx.forEach(f => { if (f.kind === 'swing' && !seen.has(f)) { seen.add(f); swings++; } }); });
  ok(shots === 0, 'a melee hero fires no basic-attack shots (' + shots + ')');
  ok(swings >= 10, 'a melee hero swings at monsters in reach (' + swings + ' in 30 s)');
  ok(S.kills > 0, 'melee swings kill monsters (' + S.kills + ')'); }
// 2. ranged: shots, no swings
{ let swings = 0; const seen = new Set(); let fired = 0, last = 9;
  run({ cls: 'Mage' }, 900, S => { if (S._baseT > last + 0.5) fired++; last = S._baseT; S.fx.forEach(f => { if (f.kind === 'swing' && !seen.has(f)) { seen.add(f); swings++; } }); });
  ok(fired >= 10, 'a ranged hero still fires its basic attack (' + fired + ')'); ok(swings === 0, 'a ranged hero never swings'); }
// 3. the arc: the blow hits a monster in front, not one behind, and lands at 0.45 s
{ const S = C.create({ key: 't', cls: 'Tank', maxHp: 1e6, atk: 100, melee: true, reach: 2.2, skills: [] }, { seed: 3 }); S._baseT = 99;
  for (let i = 0; i < 600 && S.monsters.length < 2; i++) { C.step(S, {}); S.choice = null; }
  const [front, back] = S.monsters; S.monsters = [front, back]; S.noSpawn = true;
  Object.assign(front, { x: S.hero.x + 1.5, y: S.hero.y, hp: 1e6, maxHp: 1e6, speed: 0 }); Object.assign(back, { x: S.hero.x - 1.5, y: S.hero.y + 0.3, hp: 1e6, maxHp: 1e6, speed: 0 });
  S._grid = null; S.hero.swing = null; S._baseT = 0; C.step(S, {}); ok(!!S.hero.swing, 'a swing starts when a monster is in reach');
  ok(Math.abs(S.hero.swing.a) < 0.3, 'the swing aims at the monster in front (angle ' + S.hero.swing.a.toFixed(2) + ')');
  const pin = () => { front.x = S.hero.x + 1.5; front.y = S.hero.y; back.x = S.hero.x - 1.5; back.y = S.hero.y + 0.3; };
  for (let i = 0; i < 10; i++) { pin(); C.step(S, {}); } ok(front.hp === 1e6, 'no damage before the contact (0.37 s)');
  for (let i = 0; i < 6; i++) { pin(); C.step(S, {}); } ok(front.hp < 1e6, 'the monster in front is hit at the contact (0.45 s)'); ok(back.hp === 1e6, 'the monster behind is not hit'); }
// 4. class passives
for (const cls of ['Tank', 'Bruiser', 'Mage', 'Support', 'Assassin', 'Marksman']) {
  const S = C.create({ key: 't', cls, maxHp: 500, atk: 40, skills: [] }, { seed: 1, auras: rows });
  ok(S.aurasTable.length === 10 && S.aurasTable.every(a => a.cls === cls), cls + ': the level-up passives are its own 10'); }
// Phil 28 Oct (Rivet): "melee attacks when near enemy and ranged when far" - a mixed hero swings only with a monster inside its reach,
// and shoots only when none is
{ let shots = 0, swings = 0, shotNear = 0, swingFar = 0; const seen = new Set();
  // judged on the monsters as they stood when the tick began or end it (one moved in, killed or knocked back in that tick still counted for its swing)
  let prev = []; const within = (L, S, tol) => L.some(m => Math.hypot(m.x - S.hero.x, m.y - S.hero.y) <= S.hero.reach + 0.6 + (m.r || 0) + tol);   // to the monster's edge, as nearest() does
  const inReach = S => within(prev.concat(S.monsters), S, 0.3), surelyInReach = S => within(prev, S, -0.3);
  run({ cls: 'Bruiser', mixed: true, reach: 2.2 }, 2400, S => { S.shots.forEach(s => { if (s.key === '_base' && !seen.has(s)) { seen.add(s); shots++; if (surelyInReach(S)) shotNear++; } });
    S.fx.forEach(f => { if (f.kind === 'swing' && !seen.has(f)) { seen.add(f); swings++; if (!inReach(S)) swingFar++; } }); prev = S.monsters.map(m => ({ x: m.x, y: m.y, r: m.r })); });
  ok(shots > 0 && swings > 0, 'a mixed hero both shoots and swings (' + shots + ' shots, ' + swings + ' swings)');
  ok(shotNear === 0 && swingFar === 0, 'it swings only when a monster is in reach and shoots only when none is (' + shotNear + ' near shots, ' + swingFar + ' far swings)'); }
console.log('PASS', n);
