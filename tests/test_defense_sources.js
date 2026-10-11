// Academy v2 (11 Oct 2026) - DEFENSE SOURCES (Phil: "yes do that split"). Defense is a rating (20 = 1%, cap 60%) that comes off an
// attacker's crit chance. Today's sources for a fully built tank, 40% = 800 rating:
//   glyphs 300 (15%): the Bastion family ("Damage Reduction / Health" -> "Defense / Health"); a Tank can socket Bastion in two slots
//     (bulwark + spirit), each slot banks all 13 Bastion tiers Blue..Orange = 150, two slots = 300;
//   equipment 300 (15%): the Tank helms (E09 / E10, Green) and armors (E26 / E27, Blue +2): best helm + best armor at max Temper
//     (x1.75) and max Resonance (x1.10) = (48 + 107.8) x 1.925 = 299.9 -> 300;
//   prayer 200 (10%): the Temple "Armor & Magic resist" bar, 1 Defense a step, 200 steps.
// Runs the REAL server functions (glyphFlatStats, gearHeroFlats + gearTT + gearResonanceRank from server.js in a vm, TempleOfAsh
// heroBonuses + TempleEffects.coreRatings), the combat core and the client makeUnit (spec path): each source hits its share exactly,
// the sum is 800 = 40%, server unit = client unit; every non-tank glyph / gear item is unchanged from v1122 (Bastion keeps its HP;
// the four tank items keep every old stat). Control: the same source checks on v1122 (git show ebd45c1a) FAIL. Asserts, non-zero exit.
'use strict';
const assert = require('assert'), fs = require('fs'), os = require('os'), path = require('path'), vm = require('vm'), { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..'), BASE_REF = process.env.DS_BASE || 'ebd45c1a';
let pass = 0;
const ok = (c, m) => { assert(c, m); pass++; console.log('  ok ' + m); };
const show = f => execFileSync('git', ['show', BASE_REF + ':' + f], { cwd: ROOT, maxBuffer: 1 << 28 }).toString('utf8');
const cur = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const TANK_GEAR = ['E09', 'E10', 'E26', 'E27'];

function serverFns(srv, glyphRaw, gearCat) {
  const fn = name => { const a = srv.indexOf('function ' + name + '('); assert(a >= 0, name); let i = srv.indexOf('{', a), d = 0;
    for (; i < srv.length; i++) { if (srv[i] === '{') d++; else if (srv[i] === '}' && --d === 0) break; } return srv.slice(a, i + 1); };
  const byId = {}; for (const d of glyphRaw) { byId[d.id] = d; d.stats = d.passiveStats.split(';').map(s => s.trim()).filter(Boolean).map(s => {
    const m = /^(.+?)\s*\+([\d.]+)(%?)$/.exec(s); return { stat: m[1], val: +m[2], pct: m[3] === '%' }; }); }
  gearCat.byId = {}; for (const d of gearCat.items) gearCat.byId[d.id] = d;
  const ctx = vm.createContext({ Math, GLYPHS: { byId, raw: glyphRaw }, GEARCAT: gearCat });
  vm.runInContext(['glyphFlatStats', 'gearTT', 'gearResonanceRank', 'gearHeroFlats'].map(fn).join('\n') + '\n;this.out={glyphFlatStats,gearHeroFlats};', ctx);
  const ov = srv.slice(srv.indexOf('const GLYPH_ROLE_OVERRIDES='), srv.indexOf('};', srv.indexOf('const GLYPH_ROLE_OVERRIDES=')) + 2);
  const fams = srv.slice(srv.indexOf('const GLYPH_SLOT_FAMILIES='), srv.indexOf('};', srv.indexOf('const GLYPH_SLOT_FAMILIES=')) + 2);
  vm.runInContext(fams.replace('const ', 'this.') + '\n' + ov.replace('const ', 'this.'), ctx);
  return ctx;
}
function sourcesOf(srv, glyphRaw, gearCat, TOA, TE) {
  const S = serverFns(srv, glyphRaw, gearCat), out = {};
  /* glyphs: the slots a Tank may hold Bastion in, each banking every Bastion tier (exactly as ascension banks a board) */
  const slots = Object.keys(S.GLYPH_SLOT_FAMILIES).filter(sl => ((S.GLYPH_ROLE_OVERRIDES.Tank || {})[sl] || S.GLYPH_SLOT_FAMILIES[sl]).includes('Bastion'));
  const bast = glyphRaw.filter(d => d.family === 'Bastion'), asc = {};
  for (const sl of slots) for (const d of bast) for (const s of d.stats) { const c = asc[s.stat] || { val: 0, pct: s.pct }; c.val = +(c.val + s.val).toFixed(2); asc[s.stat] = c; }
  out.glyphSlots = slots; out.glyphTiers = bast.length;
  out.glyph = S.out.glyphFlatStats({ glyphs: { boards: { brannus: { ascended: asc, slots: [] } }, finished: {} } }, 'brannus');
  /* equipment: best Tank helm + armor on the tank, Temper 30, and enough other tempered items worn to reach the top Resonance rank */
  const items = {}, equipped = { brannus: {} }; let n = 0;
  const wear = (hero, slot, d) => { const id = 'i' + (n++); items[id] = { d, temper: gearCat.meta.temper.max }; (equipped[hero] = equipped[hero] || {})[slot] = id; };
  const best = slot => gearCat.items.filter(d => d.slot === slot && /(^|• )Tank \//.test(d.roles)).sort((a, b) => gearCat.meta.qualities.indexOf(b.quality) - gearCat.meta.qualities.indexOf(a.quality))[0];
  wear('brannus', 'Helm', best('Helm').id); wear('brannus', 'Armor', best('Armor').id);
  let h = 0; for (const d of gearCat.items) { if (d.id === best('Helm').id || d.id === best('Armor').id) continue; wear('filler' + (h++), d.slot, d.id); }
  const g = { items, equipped };
  out.gearRank = vm.runInContext('gearResonanceRank', S)(g).rank;
  out.gear = S.out.gearHeroFlats({ gear: g }, 'brannus');
  out.gearItems = [best('Helm').id, best('Armor').id];
  /* prayer: a tank whose bars hold Armor & MR, that bar full (200 steps) */
  const st = TOA.newHero('brannus', 'physical'); st.steps.armorMr = 200;
  out.temple = TOA.heroBonuses(st, 'Tank', 'Physical', 'brannus');
  const R = {}, XT = {}; TE.coreRatings(R, XT, out.temple); out.templeR = R;
  return out;
}
function loadModule(code, file) { const p = path.join(os.tmpdir(), 'ew-ds-' + process.pid + '-' + file); fs.writeFileSync(p, code); try { delete require.cache[p]; return require(p); } finally { fs.rmSync(p, { force: true }); } }

try {
  const glyphNow = JSON.parse(cur('server/glyph-source.json')), gearNow = JSON.parse(cur('server/gear-catalog.json'));
  const TOA = require('../server/temple-of-ash.js'), TE = require('../server/temple-effects.js'), CORE = require('../server/combat-core.js');
  const now = sourcesOf(cur('server.js'), JSON.parse(JSON.stringify(glyphNow)), JSON.parse(JSON.stringify(gearNow)), TOA, TE);
  console.log('current tree:');
  ok(JSON.stringify(now.glyphSlots) === '["bulwark","spirit"]' && now.glyphTiers === 13, 'a Tank can hold Bastion in 2 slots (' + now.glyphSlots + '), 13 Bastion tiers Blue..Orange');
  ok(now.glyph.defense === 300, 'glyphs: 2 slots x every Bastion tier banked = ' + now.glyph.defense + ' Defense (15%)');
  ok(now.gearRank === gearNow.meta.resonance.thresholds.length && now.gear.defense === 300, 'equipment: ' + now.gearItems.join(' + ') + ' at Temper ' + gearNow.meta.temper.max + ', Resonance rank ' + now.gearRank + ' = ' + now.gear.defense + ' Defense (15%)');
  ok(now.temple.defenseFlat === 200 && now.templeR.defense === 200, 'prayer: the Armor & Magic resist bar at 200 steps = ' + now.temple.defenseFlat + ' Defense (10%), into the core ratings ' + now.templeR.defense);
  const total = now.glyph.defense + now.gear.defense + now.templeR.defense;
  const su = CORE.buildUnit('brannus', { hp: 1, dmg: 1, role: 'Tank' }, 1, 1, { defense: now.glyph.defense + now.gear.defense + now.templeR.defense }, {});
  ok(total === 800 && Math.abs(su.defense - 0.4) < 1e-12, 'fully built tank: ' + total + ' Defense = ' + (su.defense * 100) + '% (cap ' + CORE.CONV.defenseCap * 100 + '%)');
  { const host = require('../server/sim-host.js').load(path.join(ROOT, 'emberweave-heroes.html'));
    const spec = { key: 'brannus', level: 100, stars: 5, pips: 0, ref: 0, glyphRank: 6, tt: { defense: now.glyph.defense + now.gear.defense }, ex: { equip: {} }, apMul: 1, skillLv: [1, 1, 1, 1], templeBonuses: now.temple };
    const snap = host.snapFromSpecs([spec])[0];
    ok(Math.abs(snap.defenseStat - su.defense) < 1e-12, 'client unit from the same spec (glyph + gear in tt, the Temple bonuses) = server: defenseStat ' + snap.defenseStat); }
  /* nothing else moved */
  const glyphOld = JSON.parse(show('server/glyph-source.json')), gearOld = JSON.parse(show('server/gear-catalog.json'));
  ok(glyphOld.length === glyphNow.length && glyphOld.every((d, i) => d.family === 'Bastion' ? glyphNow[i].passiveStats.split('; ')[1] === d.passiveStats.split('; ')[1] && /^Defense \+[\d.]+$/.test(glyphNow[i].passiveStats.split('; ')[0]) && glyphNow[i].statFocus === 'Defense / Health'
      : JSON.stringify(d) === JSON.stringify(glyphNow[i])), 'glyphs: every non-Bastion glyph unchanged; Bastion keeps its HP, Damage Reduction became Defense ("Defense / Health")');
  ok(gearOld.items.every((d, i) => { const n = gearNow.items[i]; if (!TANK_GEAR.includes(d.id)) return JSON.stringify(d) === JSON.stringify(n);
      const s = Object.assign({}, n.stats); delete s.defense; return JSON.stringify(s) === JSON.stringify(d.stats) && n.stats.defense > 0; })
    && gearNow.items.filter(d => d.stats.defense).every(d => TANK_GEAR.includes(d.id) && /^Tank \//.test(d.roles)),
    'equipment: only the Tank helms / armors (' + TANK_GEAR.join(' ') + ') gained Defense, every old stat kept; every other item unchanged');
  console.log('control (v1122 ' + BASE_REF + '):');
  const TOAo = loadModule(show('server/temple-of-ash.js'), 'toa.js'), TEo = loadModule(show('server/temple-effects.js'), 'te.js');
  const old = sourcesOf(show('server.js'), glyphOld, gearOld, TOAo, TEo);
  ok(!(old.glyph.defense === 300), 'control: v1122 glyphs give ' + (old.glyph.defense | 0) + ' Defense, not 300');
  ok(!(old.gear.defense === 300), 'control: v1122 equipment gives ' + (old.gear.defense | 0) + ' Defense, not 300');
  ok(!(old.templeR.defense === 200), 'control: v1122 prayer gives ' + (old.templeR.defense | 0) + ' Defense, not 200');
  console.log('test_defense_sources.js: ' + pass + ' checks passed');
} catch (e) { console.error('FAIL', e && e.message || e); process.exitCode = 1; }
