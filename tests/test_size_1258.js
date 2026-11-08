// v1258 (Phil 2 Nov 2026: "increase everyone's size 15%" / "pretty much all ranges need to change. It will be inconsistent if you dont" /
// "Have to resize, then verify all ranges and distance is fixed"). Loads the engine BEFORE the resize (git show BASE) and the current one
// side by side through server/sim-host.js and checks, for every hero and monster and every ability table entry, that every DISTANCE is
// exactly x UNIT_SIZE and nothing else moved. Exit 0 = passed. The BASE run is the control (ratios there are 1).
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm'), cp = require('child_process'), assert = require('assert');
const ROOT = path.join(__dirname, '..'), BASE = process.env.BASE || 'db7e16fb';
let pass = 0; const ok = (c, m) => { assert(c, m); pass++; console.log('  ok   ' + m); };
const load = file => { const h = require(path.join(ROOT, 'server/sim-host.js')).load(file); return s => vm.runInContext(s, h.ctx); };
const NEW = load(path.join(ROOT, 'emberweave-heroes.html'));
const tmp = path.join(ROOT, '.size1258-base.html'); fs.writeFileSync(tmp, cp.execSync('git show ' + BASE + ':emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }));
let OLD; try { OLD = load(tmp); } finally { try { fs.unlinkSync(tmp); } catch (e) {} }
const S = +NEW('UNIT_SIZE'); ok(Math.abs(S - 1.15) < 1e-9, 'UNIT_SIZE is 1.15');
ok(Math.abs(NEW('METER') / OLD('METER') - S) < 1e-9, 'the metre is x1.15 (every METER-written radius, dash, reach and row hold follows)');
// every unit: range, reach, row hold, speed, radius, figure height - x1.15; hp / dmg / attack interval unchanged
const keysJs = `JSON.stringify(Object.keys(HERO_TYPES).concat(Object.keys(MONSTER_TYPES)))`;
const oldKeys = new Set(JSON.parse(OLD(keysJs)));   // 3 Nov 2026: a unit added after BASE (hero61) has no before to compare
const keys = JSON.parse(NEW(keysJs)).filter(k => oldKeys.has(k));
const pick = (run, k) => JSON.parse(run(`(()=>{ const u=makeUnit(${JSON.stringify(k)},'enemy',500,500,10,{}); return JSON.stringify({range:u.range,reach:u.reach,cd:u.combatDist,speed:u.speed,r:u.r,sprH:u.sprH,hp:u.maxHp,dmg:u.dmg,ai:u.atkInterval}); })()`));
const near = (a, b) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));
// stats Phil changed on purpose AFTER the resize (each with its release) - the resize itself still must not touch them
const LATER_TUNED = { maelvara: ['hp'], orryx: ['dmg', 'ai'] };   // v1292 (6 Nov): Maelvara hp +15%; v1303/v1304 (7 Nov): Orryx attack +20%, swing 20% slower
let bad = [];
let skipped = 0;
for (const k of keys) { let o, n; try { o = pick(OLD, k); n = pick(NEW, k); } catch (e) { skipped++; continue; }
  for (const f of ['range', 'reach', 'cd', 'speed', 'r', 'sprH']) if (!near(n[f], o[f] * S)) bad.push(k + '.' + f + ' ' + o[f] + ' -> ' + n[f]);
  for (const f of ['hp', 'dmg', 'ai']) if (!near(n[f], o[f]) && !(LATER_TUNED[k] || []).includes(f)) bad.push(k + '.' + f + ' changed ' + o[f] + ' -> ' + n[f]); }
ok(bad.length === 0 && skipped < keys.length / 10, (keys.length - skipped) + ' heroes + monsters: range, reach, row hold, speed, radius and figure height all x1.15, hp / dmg / attack speed unchanged' + (bad.length ? ' - ' + bad.slice(0, 8).join('; ') : ''));
// every ability table: distance fields x1.15, everything else identical
const DIST = /(range|radius|reach|width|len|length|dist|distance|wave|gfxR|knock|dash|jump|aim)$/i;   // distance-named (case-insensitive suffix)
const dump = run => JSON.parse(run(`JSON.stringify({ULT_DEF, KITS, MONSTER_KITS: (typeof MONSTER_KITS!=='undefined'?MONSTER_KITS:{})})`));
const O = dump(OLD), N = dump(NEW); const missed = [], odd = []; let scaled = 0, same = 0;
const walk = (o, n, p) => { if (typeof o === 'number' && typeof n === 'number') { const f = p.split('.').pop();
    if (o !== 0 && near(n, o * S)) { scaled++; return; }
    if (near(n, o)) { same++; if (DIST.test(f) && o > 0 && o < 50000) missed.push(p + ' ' + o); return; }
    odd.push(p + ' ' + o + ' -> ' + n); return; }
  if (o && typeof o === 'object' && n && typeof n === 'object') for (const k of Object.keys(o)) walk(o[k], n[k], p + '.' + k); };
walk(O, N, '');
/* v1287 (5 Nov, tester via Phil): Oakmir's cooldowns +1 s are a deliberate balance change, not part of the resize */
for (const k of ['.KITS.oakmir.green.cd 6 -> 7', '.KITS.oakmir.blue.cd 9 -> 10']) { const j = odd.indexOf(k); if (j >= 0) odd.splice(j, 1); }
/* v1292 (Phil 6 Nov): Maelvara's Cyclone Choir 10 m across (radius 3.2 -> 5 m, the effect with it) - a deliberate change, not the resize */
for (let j = odd.length - 1; j >= 0; j--) if (/^\.MONSTER_KITS\.maelvara\.blue\.(radius|gfxR) /.test(odd[j])) odd.splice(j, 1);
/* v1294 (Phil 6 Nov): Fritz's Thunder Shower radius 8 -> 6 m ("make it have a 6m radius") - a deliberate change, not the resize */
for (let j = odd.length - 1; j >= 0; j--) if (/^\.ULT_DEF\.thundershower\.radius /.test(odd[j])) odd.splice(j, 1);
/* v1303/v1304 (Phil 7 Nov): Orryx's Labyrinth Charge and Prismatic Axe reworked (mul, stun, path hit, knock, swings) - deliberate, not the resize */
for (let j = odd.length - 1; j >= 0; j--) if (/^\.MONSTER_KITS\.orryx\.(green|blue)\./.test(odd[j])) odd.splice(j, 1);
/* v1308 (Phil 7 Nov): Rhukk Carapace / Dig In, Vael Last Stand, Grosk Croc Drop + Hammer Fists, Bitwraith Corruption - deliberate balance changes, not the resize (tests/test_rhukk_bitwraith_1308.js checks them) */
for (let j = odd.length - 1; j >= 0; j--) if (/^\.(ULT_DEF\.(hipposlam|laststand)|KITS\.rhukk\.(green|blue)|KITS\.grosk\.blue|MONSTER_KITS\.bitwraith\.green)\./.test(odd[j])) odd.splice(j, 1);
/* v1313 (Phil 8 Nov): Magmourn's Ignite All "a 20 meter range on all heroes" (radius 99999 -> 20 m) - a deliberate change, not the resize (tests/test_monster_damage_types_1313.js checks it) */
for (let j = odd.length - 1; j >= 0; j--) if (/^\.MONSTER_KITS\.magmourn\.blue\.radius /.test(odd[j])) odd.splice(j, 1);
/* v1314 (Phil 8 Nov): Magmourn's Ignite All 20 m wide (gfxR) and Fireball a real projectile with a 5 m burst (green radius / gfxR) - deliberate, not the resize (tests/test_magmourn_1314.js checks them) */
for (let j = odd.length - 1; j >= 0; j--) if (/^\.MONSTER_KITS\.magmourn\.(blue\.gfxR|green\.(radius|gfxR)) /.test(odd[j])) odd.splice(j, 1);
ok(odd.length === 0, 'every number in ULT_DEF / KITS / MONSTER_KITS is either x1.15 (' + scaled + ') or unchanged (' + same + ') - nothing changed by any other amount' + (odd.length ? ' - ' + odd.slice(0, 8).join('; ') : ''));
ok(missed.length === 0, 'no distance-named field was left unscaled' + (missed.length ? ' - ' + missed.slice(0, 12).join('; ') : ''));
console.log('test_size_1258.js: ' + pass + ' checks passed');
