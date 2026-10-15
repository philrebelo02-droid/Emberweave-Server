// Academy v2 (11 Oct 2026) - DEFENSE SOURCES (Phil: "yes do that split"). Defense is a rating (20 = 1%, cap 60%) that comes off an
// attacker's crit chance. Today's sources for a fully built tank, 40% = 800 rating:
//   glyphs 300 (15%): the IRONWALL family ("Armor / Block / Defense", Armor and Block kept). A melee tank's personal path holds Ironwall
//     in 2 slots at Grey / Green / Green +1 and 1 slot Blue..Orange: 2 x (5.9+7+7.5) + (8.6+...+36.7) = 300. Checked on a LIVE server:
//     a real tank's board at ascension 16 is recomputed at boot from its real path (migrateGlyphDefenseAv2) and read back;
//   equipment 300 (15%): the Tank helms (E09 / E10, Green) and armors (E26 / E27, Blue +2): best helm + best armor at max Temper
//     (x1.75) and max Resonance (x1.10) = (48 + 107.8) x 1.925 = 299.9 -> 300;
//   prayer 200 (10%): the Temple "Armor, Magic resist & Defense" bar, 1 Defense a step, 200 steps.
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
function sourcesOf(srv, glyphRaw, gearCat, TOA, TE, bankedAsc) {
  const S = serverFns(srv, glyphRaw, gearCat), out = {};
  /* glyphs: the tank's board as the live server banked it from the real path */
  out.glyph = S.out.glyphFlatStats({ glyphs: { boards: { brannus: { ascended: bankedAsc || {}, slots: [] } }, finished: {} } }, 'brannus');
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

const net = require('net'), { spawn } = require('child_process');
const delay = ms => new Promise(r => setTimeout(r, ms));
const freePort = () => new Promise(r => { const sv = net.createServer(); sv.listen(0, '127.0.0.1', () => { const p = sv.address().port; sv.close(() => r(p)); }); });
async function liveBanked() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-ds-')), dbFile = path.join(dir, 'db.json'), port = await freePort(), base = 'http://127.0.0.1:' + port;
  let child = null;
  const start = async () => { child = spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, ALLOW_NEW_GUESTS:'1', DATABASE_URL: '', PORT: String(port), DB_FILE: dbFile }, stdio: 'ignore', windowsHide: true });
    for (let i = 0; i < 300; i++) { try { if ((await fetch(base + '/health')).ok) return; } catch (_) {} await delay(100); } throw Error('no start'); };
  const stop = async () => { if (!child) return; await delay(400); child.kill(); for (let i = 0; i < 60 && child.exitCode === null; i++) await delay(50); child = null; };
  try {
    await start(); const g = await (await fetch(base + '/api/guest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId: 'ds-' + Date.now() }) })).json();
    await fetch(base + '/api/ledger', { headers: { 'x-token': g.token } }); await stop();
    const otherKey = 'aureth';
    let db = JSON.parse(fs.readFileSync(dbFile, 'utf8')); const u = db.users[g.profile.id];
    u.glyphs = Object.assign(u.glyphs || {}, { revision: 1, fragments: {}, subGlyphs: {}, finished: {}, tankPath1019: 1, paths1022: 1 });
    delete u.glyphs.defense1123;
    u.glyphs.boards = { brannus: { slots: [null, null, null, null, null, null], ascensionIndex: 16, ascended: {} }, [otherKey]: { slots: [null, null, null, null, null, null], ascensionIndex: 16, ascended: {} } };
    fs.writeFileSync(dbFile, JSON.stringify(db)); await start(); await stop();
    db = JSON.parse(fs.readFileSync(dbFile, 'utf8')); const b = db.users[g.profile.id].glyphs.boards;
    const iw = JSON.parse(cur('server/glyph-source.json')).filter(d => d.family === 'Ironwall').slice(0, 3).map(d => +/Defense \+([\d.]+)/.exec(d.passiveStats)[1]);
    return { tank: b.brannus.ascended, other: b[otherKey].ascended, otherKey, ironQ0to2: +iw.reduce((a, c) => a + c, 0).toFixed(2), marker: db.users[g.profile.id].glyphs.defense1123 };
  } finally { await stop(); fs.rmSync(dir, { recursive: true, force: true }); }
}
let liveAsc = null;
(async () => { try {
  liveAsc = await liveBanked();
  const glyphNow = JSON.parse(cur('server/glyph-source.json')), gearNow = JSON.parse(cur('server/gear-catalog.json'));
  const TOA = require('../server/temple-of-ash.js'), TE = require('../server/temple-effects.js'), CORE = require('../server/combat-core.js');
  const now = sourcesOf(cur('server.js'), JSON.parse(JSON.stringify(glyphNow)), JSON.parse(JSON.stringify(gearNow)), TOA, TE, liveAsc.tank);
  console.log('current tree:');
  { const P = require('../server/hero-personal-glyph-paths.json').heroes.brannus.tiers.map(t => t.filter(f => f === 'Ironwall').length);
    ok(P.join('') === '2221111111111111', 'Brannus (melee tank) path: Ironwall slots per tier ' + P.join('') + ' (19 Ironwall glyphs over 16 tiers)'); }
  ok(liveAsc.marker === 1 && now.glyph.defense === 300, 'glyphs: Brannus\'s board at ascension 16, banked by the live server from his real path = ' + now.glyph.defense + ' Defense (15%)');
  { const o = liveAsc.other.Defense ? liveAsc.other.Defense.val : 0;
    ok(Math.abs(o - (300 - liveAsc.ironQ0to2)) < 1e-6, 'a non-tank with Ironwall once a tier (' + liveAsc.otherKey + ') banks ' + o + ' Defense (300 minus the tank-only second slot at Grey..Green +1, ' + liveAsc.ironQ0to2 + ')'); }
  ok(now.gearRank === gearNow.meta.resonance.thresholds.length && now.gear.defense === 300, 'equipment: ' + now.gearItems.join(' + ') + ' at Temper ' + gearNow.meta.temper.max + ', Resonance rank ' + now.gearRank + ' = ' + now.gear.defense + ' Defense (15%)');
  ok(now.temple.defenseFlat === 200 && now.templeR.defense === 200, 'prayer: the Armor, Magic resist & Defense bar at 200 steps = ' + now.temple.defenseFlat + ' Defense (10%), into the core ratings ' + now.templeR.defense);
  { const st = TOA.newState(); st.heroes = { brannus: TOA.newHero('brannus', 'physical') }; st.heroes.brannus.steps.armorMr = 40;
    const bar = TOA.heroTempleStats(st, 'brannus', { role: 'Tank', damageProfile: 'Physical' }).bars.find(b => b.kind === 'armorMr');
    ok(bar.name === 'Armor, Magic resist & Defense' && / \/ Defense \+40$/.test(bar.text), 'the Temple bar names Defense and shows it in its value: "' + bar.name + ' ' + bar.text + '"'); }
  const total = now.glyph.defense + now.gear.defense + now.templeR.defense;
  const su = CORE.buildUnit('brannus', { hp: 1, dmg: 1, role: 'Tank' }, 1, 1, { defense: now.glyph.defense + now.gear.defense + now.templeR.defense }, {});
  ok(total === 800 && Math.abs(su.defense - 0.4) < 1e-12, 'fully built tank: ' + total + ' Defense = ' + (su.defense * 100) + '% (cap ' + CORE.CONV.defenseCap * 100 + '%)');
  { const host = require('../server/sim-host.js').load(path.join(ROOT, 'emberweave-heroes.html'));
    const spec = { key: 'brannus', level: 100, stars: 5, pips: 0, ref: 0, glyphRank: 6, tt: { defense: now.glyph.defense + now.gear.defense }, ex: { equip: {} }, apMul: 1, skillLv: [1, 1, 1, 1], templeBonuses: now.temple };
    const snap = host.snapFromSpecs([spec])[0];
    ok(Math.abs(snap.defenseStat - su.defense) < 1e-12, 'client unit from the same spec (glyph + gear in tt, the Temple bonuses) = server: defenseStat ' + snap.defenseStat); }
  /* nothing else moved */
  const glyphOld = JSON.parse(show('server/glyph-source.json')), gearOld = JSON.parse(show('server/gear-catalog.json'));
  ok(glyphOld.length === glyphNow.length && glyphOld.every((d, i) => d.family === 'Ironwall' ? glyphNow[i].passiveStats.startsWith(d.passiveStats + '; Defense +') && glyphNow[i].statFocus === 'Armor / Block / Defense'
      : JSON.stringify(d) === JSON.stringify(glyphNow[i])), 'glyphs: every non-Ironwall glyph (Bastion included) is exactly v1122; Ironwall keeps Armor and Block and adds Defense');
  ok(gearOld.items.every((d, i) => { const n = gearNow.items[i]; if (!TANK_GEAR.includes(d.id)) return JSON.stringify(d) === JSON.stringify(n);
      const s = Object.assign({}, n.stats); delete s.defense; return JSON.stringify(s) === JSON.stringify(d.stats) && n.stats.defense > 0; })
    && gearNow.items.filter(d => d.stats.defense).every(d => TANK_GEAR.includes(d.id) && /^Tank \//.test(d.roles)),
    'equipment: only the Tank helms / armors (' + TANK_GEAR.join(' ') + ') gained Defense, every old stat kept; every other item unchanged');
  console.log('control (v1122 ' + BASE_REF + '):');
  const TOAo = loadModule(show('server/temple-of-ash.js'), 'toa.js'), TEo = loadModule(show('server/temple-effects.js'), 'te.js');
  /* control: the v1122 catalog banked along the same real path (Brannus's path glyphs summed from the old source) */
  const oldAsc = {}; { const P = require('../server/hero-personal-glyph-paths.json').heroes.brannus.tiers, Q = [...new Set(glyphOld.map(d => d.quality))];
    P.forEach((t, qi) => t.forEach(f => { const d = glyphOld.find(x => x.family === f && x.quality === Q[qi]); if (!d) return;
      d.passiveStats.split(';').map(x => x.trim()).forEach(x => { const m = /^(.+?)\s*\+([\d.]+)(%?)$/.exec(x); const c = oldAsc[m[1]] || { val: 0, pct: m[3] === '%' }; c.val += +m[2]; oldAsc[m[1]] = c; }); })); }
  const old = sourcesOf(show('server.js'), glyphOld, gearOld, TOAo, TEo, oldAsc);
  ok(!(old.glyph.defense === 300), 'control: v1122 glyphs give ' + (old.glyph.defense | 0) + ' Defense, not 300');
  ok(!(old.gear.defense === 300), 'control: v1122 equipment gives ' + (old.gear.defense | 0) + ' Defense, not 300');
  ok(!(old.templeR.defense === 200), 'control: v1122 prayer gives ' + (old.templeR.defense | 0) + ' Defense, not 200');
  console.log('test_defense_sources.js: ' + pass + ' checks passed');
} catch (e) { console.error('FAIL', e && e.message || e); process.exitCode = 1; } })();
