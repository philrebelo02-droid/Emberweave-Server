/* Swarm Spire: every ability of every playable hero has its effect (31 Oct 2026, Phil: "Verify all abilities work in spire. Aldrens doesnt").
   For EVERY hero the game offers in the Spire (survivorsRoster() from the game's own page, loaded headless by server/sim-host.js), each
   skill and the ULT is pressed the way the Spire presses it (the kit the game sends the frame -> survivors-core create/step, the same
   fields survivors-dev.html passes) in a quiet arena: seven 1e7-HP dummies round the hero, no spawns, no basic attack, hero at half HP.
   What each one must do comes from the GAME's row for it (KITS[hero].green/blue type, HERO_TYPES ability + ULT_DEF), not from the
   Spire's own reading of it:
     summon types (summon*)                   -> its unit(s) rise and strike a dummy
     heal types (mendburst, hot, heal, ...)   -> the hero's HP goes up
     shield types (lastbreath, ...)           -> the ward is up (HP cannot drop below 1)
     every other skill                        -> a dummy takes damage or a control/debuff (stun, slow, dot, vuln, moved)
     an ult whose game ult is a summon        -> that unit (Aldren's Final Volume = the Elder Ink Horror); any other ult hurts a dummy
   Self/ally BUFF skills (haste, banner, ...) have no ally to buff in a one-hero mode; the Spire plays them as a burst. They pass if they
   do something and are listed as DESIGN for Phil. Prints a hero x ability table; exit 1 on any FAIL.
   Control: on claude/v1232 3cf22180 (before this fix) Aldren's ULT fails (no Ink Horror), with the dash and 'shot' skills.
   Run: node tests/test_spire_abilities_all.js   (NODE_PATH not needed) */
'use strict';
const path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const host = require(path.join(ROOT, 'server', 'sim-host.js')).load(process.env.AUD_HTML || path.join(ROOT, 'emberweave-heroes.html'));
const C = require(path.join(ROOT, 'server', 'survivors-core.js'));

const roster = JSON.parse(vm.runInContext(`JSON.stringify(survivorsRoster().filter(h => h.playable).map(h => {
  const T = HERO_TYPES[h.key] || {}, K = KITS[h.key] || {}, U = ULT_DEF[T.ability] || {};
  return { key: h.key, cls: h.cls, kit: h.kit, game: { green: K.green && K.green.type, blue: K.blue && K.blue.type, ult: T.ability, ultKey: U.key || '' } }; }))`, host.ctx));

const HEAL = new Set(['mendburst', 'linkheal', 'healbuff', 'orbheal', 'hot', 'heal']);
const SHIELD = new Set(['lastbreath', 'harmonyshield', 'dawnward', 'burrowguard', 'thornguard']);
const BUFF = new Set(['haste', 'banner', 'defensive', 'lifestealbuff', 'energygift', 'honeyglob']);   // ally/self buffs: no ally here (DESIGN)
const DUMMIES = [[3, 0], [4.5, 0.8], [2, -1.2], [6, -0.5], [-2.5, 1], [0, 3], [8, 0]];
const SEC = s => Math.round(s / C.TICK);

function arena(h) {
  const k = h.kit;
  const S = C.create({ key: h.key, cls: h.cls, maxHp: 3000, atk: 260, armor: 300, crit: 0, critDmg: 0.6,
    skills: k.skills.map(s => Object.assign({ anim: 'Cast' }, s)), ultSummon: k.ult && k.ult.summon,
    melee: !!k.melee, mixed: !!k.mixed, reach: k.reach }, { mode: 'story', stage: 1, seed: 11 });
  S.noSpawn = true; S._baseT = 1e9; S.hero.hp = S.hero.maxHp * 0.5;
  DUMMIES.forEach(([x, y]) => S.monsters.push({ id: S.nextId++, type: 'brute', x, y, hp: 1e7, maxHp: 1e7, dmg: 0, spd: 0, r: 0.6 }));
  return S;
}
// press (skill slot i, or 'ult'), then watch for `secs`
function press(h, which, secs) {
  const S = arena(h), hp0 = S.hero.hp, x0 = S.hero.x, y0 = S.hero.y, pos0 = S.monsters.map(m => [m.x, m.y]);
  let ward = 0, allies = 0, units = new Set(), healed = 0, deb = 0;
  if (which === 'ult') S.hero.ult = S.hero.ultMax;
  const look = () => { if (S.hero.wardT > 0) ward = 1; if (S.hero.hp > hp0 + 1e-6) healed = 1;
    (S.allies || []).forEach(a => units.add(a.unit)); allies = Math.max(allies, (S.allies || []).length);
    S.monsters.forEach((m, i) => { if (m.stunT > 0 || m.slowT > 0 || m.dotT > 0 || m.vuln > 0 || Math.hypot(m.x - pos0[i][0], m.y - pos0[i][1]) > 0.05) deb = 1; }); };
  C.step(S, which === 'ult' ? { ult: true } : { skill: which }); look();
  const used = which === 'ult' ? S.fx.some(f => f.kind === 'ult' && f.seq) : S.hero.kit[which].cdLeft > 0;
  for (let t = 0; t < SEC(secs); t++) { C.step(S, {}); look(); }
  const dmg = S.monsters.reduce((a, m) => a + (1e7 - m.hp), 0);
  return { used, dmg, deb, healed, ward, allies, units, moved: Math.hypot(S.hero.x - x0, S.hero.y - y0) };
}

const rows = [], fails = [], design = [];
let ok = 0;
for (const h of roster) {
  const cells = [];
  const slots = h.kit.skills.map((s, i) => ({ i, s, type: h.game[i === 0 ? 'green' : 'blue'] || '' }));
  for (const { i, s, type } of slots) {
    const summon = /^summon/.test(type), r = press(h, i, summon ? 5 : 3);
    let why = '';
    if (!r.used) why = 'press did not fire';
    else if (summon) { if (!r.allies) why = 'no summon'; else if (!(r.dmg > 0)) why = 'summon never struck'; else if (s.unit && !r.units.has(s.unit)) why = 'wrong unit'; }
    else if (HEAL.has(type)) { if (!r.healed) why = 'no heal (' + s.kind + ')'; }
    else if (SHIELD.has(type)) { if (!r.ward) why = 'no ward (' + s.kind + ')'; }
    else if (!(r.dmg > 0) && !r.deb) why = 'no hit on an enemy (' + s.kind + (r.healed ? ', healed self instead' : '') + ')';
    if (!why && BUFF.has(type)) design.push(h.key + ' ' + s.name + ' (' + type + ' -> ' + s.kind + ')');
    cells.push([s.name, why]); why ? fails.push(h.key + ' ' + s.name + ': ' + why) : ok++;
  }
  { const summon = /^summon/.test(h.game.ult || '') && h.game.ultKey, r = press(h, 'ult', summon ? 5 : 1.5), nm = (h.kit.ult && h.kit.ult.name) || 'Ultimate';
    let why = '';
    if (!r.used) why = 'press did not fire';
    else if (summon) { if (!r.units.has(h.game.ultKey)) why = 'no ' + h.game.ultKey + ' (game ult is a summon)'; else if (!(r.dmg > 0)) why = h.game.ultKey + ' never struck'; }
    else if (!(r.dmg > 0)) why = 'no hit on an enemy';
    cells.push(['ULT ' + nm, why]); why ? fails.push(h.key + ' ULT ' + nm + ': ' + why) : ok++; }
  rows.push([h.key, cells]);
}

const w = Math.max(...rows.map(r => r[0].length));
for (const [k, cells] of rows) console.log(k.padEnd(w), ' | ', cells.map(([n, why]) => n + ' = ' + (why ? 'FAIL (' + why + ')' : 'OK')).join('  |  '));
if (design.length) { console.log('\nDESIGN (a self/ally buff in the game; the Spire has no ally, it plays as a burst):'); design.forEach(d => console.log('  ' + d)); }
console.log('\n' + roster.length + ' heroes, ' + (ok + fails.length) + ' abilities: ' + ok + ' OK, ' + fails.length + ' FAIL');
if (roster.length < 50) { console.log('FAIL roster too small: ' + roster.length); process.exit(1); }
if (fails.length) { fails.forEach(f => console.log('FAIL ' + f)); process.exit(1); }
console.log('test_spire_abilities_all: all ' + ok + ' abilities have their effect');
