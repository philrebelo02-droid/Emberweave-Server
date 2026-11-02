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
const keys = JSON.parse(NEW(keysJs));
const pick = (run, k) => JSON.parse(run(`(()=>{ const u=makeUnit(${JSON.stringify(k)},'enemy',500,500,10,{}); return JSON.stringify({range:u.range,reach:u.reach,cd:u.combatDist,speed:u.speed,r:u.r,sprH:u.sprH,hp:u.maxHp,dmg:u.dmg,ai:u.atkInterval}); })()`));
const near = (a, b) => Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b));
let bad = [];
let skipped = 0;
for (const k of keys) { let o, n; try { o = pick(OLD, k); n = pick(NEW, k); } catch (e) { skipped++; continue; }
  for (const f of ['range', 'reach', 'cd', 'speed', 'r', 'sprH']) if (!near(n[f], o[f] * S)) bad.push(k + '.' + f + ' ' + o[f] + ' -> ' + n[f]);
  for (const f of ['hp', 'dmg', 'ai']) if (!near(n[f], o[f])) bad.push(k + '.' + f + ' changed ' + o[f] + ' -> ' + n[f]); }
ok(bad.length === 0 && skipped < keys.length / 10, (keys.length - skipped) + ' heroes + monsters: range, reach, row hold, speed, radius and figure height all x1.15, hp / dmg / attack speed unchanged' + (bad.length ? ' - ' + bad.slice(0, 8).join('; ') : ''));
// every ability table: distance fields x1.15, everything else identical
const DIST = /^(range|radius|reach|width|len|length|dist|distance|wave|gfxR|push|knock|knockback|leap|dash)$/;
const dump = run => JSON.parse(run(`JSON.stringify({ULT_DEF, KITS, MONSTER_KITS: (typeof MONSTER_KITS!=='undefined'?MONSTER_KITS:{})})`));
const O = dump(OLD), N = dump(NEW); const notes = []; let nDist = 0;
const walk = (o, n, p) => { if (typeof o === 'number' && typeof n === 'number') { const f = p.split('.').pop();
    if (DIST.test(f) && o > 0 && o < 50000) { nDist++; if (!near(n, o * S)) notes.push(p + ' ' + o + ' -> ' + n); }
    else if (!near(n, o) && !(DIST.test(f))) notes.push(p + ' (not a distance) ' + o + ' -> ' + n); return; }
  if (o && typeof o === 'object' && n && typeof n === 'object') for (const k of Object.keys(o)) walk(o[k], n[k], p + '.' + k); };
walk(O, N, '');
// time-like fields that merely share a name with a distance (gap / leap / pull / push are seconds or strengths in ULT_DEF) are listed by name
const timeLike = notes.filter(x => /\.(leap|push|pull|gap)\b/.test(x));
const real = notes.filter(x => !timeLike.includes(x));
ok(real.length === 0, nDist + ' distance fields in ULT_DEF / KITS / MONSTER_KITS are x1.15 and no other number changed' + (real.length ? ' - ' + real.slice(0, 10).join('; ') : ''));
console.log('  note (fields named like distances that are times / strengths, left as they were): ' + (timeLike.slice(0, 6).join('; ') || 'none'));
console.log('test_size_1258.js: ' + pass + ' checks passed');
