// v1372 (Phil 11 Nov 2026: "vault 80+ is too hard" / "my level 100 team gets 1 shot by orynnx"; and his 8 Nov rule that fights
// must still hurt: "They dont do any damage anymore" was a failure). Vault floors 60-100 re-tuned in the real engine, stats only
// (hpMul / dmgMul / recommendedPower). This test pins, in the real client battle code (server/sim-host.js -> simCampaignReplay, the
// Vault's authored-wave spawn) with the Affinities switch ON, using the frozen benchmark teams of tests/fixtures/vault_bench_1372.json
// (Phil's and the Dive comp at 0.9 x the maxed power of the floor's level):
//  1. no one-shots: before the engine's time ramp (rageMul <= 1.5, the first ~25 s of a wave) no single enemy hit takes more than
//     40% of the floor's YARDSTICK from a non-tank (Y = median max HP of the benchmark's non-tank heroes, ~8,000 at level 86), and no
//     full-HP hero dies to one hit;
//  2. bosses threaten: on the nine boss floors the benchmark loses heroes (>= 0.3 deaths per fight on average), every boss lands a
//     pre-ramp hit of at least 15% of Y, and no benchmark fight on a boss floor is lost on the wave timer;
//  3. Phil's level-100 team (his comp, fully maxed at 100) clears floor 80 every seed, no hero dies to one hit and no hit takes over
//     40% of the hero it lands on;
//  4. the climb (60-100): recommendedPower (= the 85% team's card power / 3.0908) never falls from one normal floor to the next, every
//     boss floor is above both neighbours but at most 1.6x the floor before it, floor 100 is the highest;
//  5. nothing else changed: floors 1-59 byte-identical, 60-100 keep keys, levels, boss flags, boss rules and rewards.
// CONTROL: the c48bb4a3 table fails 1, 3 and 4.
const fs = require('fs'), path = require('path'), cp = require('child_process'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
let P = 0, F = 0; const ck = (n, c, x) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n + (x ? ' - ' + x : '')); } };
const OLD_SHA = 'c48bb4a3';
const now = JSON.parse(fs.readFileSync(path.join(ROOT, 'server/vault-encounters.json'), 'utf8')).floors;
const old = JSON.parse(cp.execSync('git show ' + OLD_SHA + ':server/vault-encounters.json', { cwd: ROOT, maxBuffer: 64 << 20 }).toString()).floors;
const FX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'vault_bench_1372.json'), 'utf8'));
const CAP = 0.40, BOSS_HIT = 0.15, BOSS_DEATHS = 0.3;

/* the engine with the Affinities switch ON (allies 1.30x apart, elements, class edges) - a temp copy beside the real page */
const html = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8');
ck('the page has the Affinities switch', /const AFFINITIES_LIVE=(true|false);/.test(html));
const TMP = path.join(ROOT, '.test_vault_curve_1372.tmp.html');
fs.writeFileSync(TMP, html.replace(/const AFFINITIES_LIVE=(true|false);/, 'const AFFINITIES_LIVE=true;'));
let host; try { host = require(path.join(ROOT, 'server', 'sim-host.js')).load(TMP); } finally { try { fs.unlinkSync(TMP); } catch (e) {} }
vm.runInContext('autoUlt=true;', host.ctx); const SB = host.sandbox;
ck('Affinities ON in the test engine', vm.runInContext('AFFINITIES_LIVE', host.ctx) === true);
vm.runInContext(`var __h=null; var __dd=dealDamage;
dealDamage=function(src,tgt,amt,color,kind,silent){
  if(!__h||!tgt||!src||tgt.team!=='ally'||src.team!=='enemy'||!tgt.alive) return __dd.apply(this,arguments);
  const b=tgt.hp+(tgt.shield||0), full=tgt.hp>=tgt.maxHp*0.999; const r=__dd.apply(this,arguments);
  const loss=b-(tgt.hp+(tgt.shield||0)), f=loss/Math.max(1,tgt.maxHp);
  if(loss>0){ const tank=unitClass(tgt)==='Tank', dead=!tgt.alive||tgt.hp<=0, h=__h;
    if(dead) h.deaths++; if(f>h.max){ h.max=f; h.who=src.key+'>'+tgt.key; } if(full&&dead) h.os++;
    if(rageMul<=1.5){ if(!tank&&loss>h.absE){ h.absE=loss; h.whoE=src.key+'>'+tgt.key; } if(full&&dead){ h.osE++; h.osWho=src.key+'>'+tgt.key; }
      if(src._isBossUnit&&loss>h.bossE) h.bossE=loss; } }
  return r; };`, host.ctx);
const snaps = ids => ids.map(id => host.snapFromSpecs([FX.specs[id]])[0]);
function fight(ids, waves, seed) { const h = { max: 0, absE: 0, bossE: 0, os: 0, osE: 0, deaths: 0, who: '', whoE: '', osWho: '' }; SB.__h = h; let won = false, t = null;
  /* the boss unit is the one with the most max HP among the authored boss=true specs: tag it on spawn */
  const bossKeys = new Set(waves.flat().filter(m => m.boss).map(m => m.key));
  vm.runInContext('__bossKeys=' + JSON.stringify([...bossKeys]) + ';', host.ctx);
  try { won = !!SB.simCampaignReplay(snaps(ids), JSON.parse(JSON.stringify(waves)), seed >>> 0, [], false); } finally { SB.__h = null; }
  try { t = JSON.parse(SB._p2digest).t; } catch (e) {}
  return { won, h, timeout: !won && t != null && t >= 89 }; }
vm.runInContext(`var __bossKeys=[]; var __mu=makeUnit; makeUnit=function(key,team){ const u=__mu.apply(this,arguments); if(team==='enemy'&&__bossKeys.indexOf(key)>=0&&arguments[5]&&arguments[5].boss) u._isBossUnit=true; return u; };`, host.ctx);
const SEEDS = [1372, 9161];
function benchScan(table) { let worst = { r: 0 }, os = 0, bad = [], osWho = []; const boss = {};
  for (const f of table.filter(f => f.floor >= 60)) for (const cn of ['Phil', 'Dive']) for (const s of SEEDS) {
    const r = fight(FX.teams[f.floor + ':' + cn], f.waves, s + f.floor), Y = FX.Y[f.floor], q = r.h.absE / Y; os += r.h.osE; if (r.h.osE) osWho.push(f.floor + ' ' + r.h.osWho);
    if (q > worst.r) worst = { r: q, floor: f.floor, who: r.h.whoE, abs: Math.round(r.h.absE), Y };
    if (q > CAP) bad.push(f.floor + ' ' + r.h.whoE + ' ' + Math.round(r.h.absE) + '/' + Y);
    if (f.floor % 5 === 0) { const B = boss[f.floor] = boss[f.floor] || { n: 0, deaths: 0, tmo: 0, hit: 0, Y }; B.n++; B.deaths += r.h.deaths; if (r.timeout) B.tmo++; B.hit = Math.max(B.hit, r.h.bossE); } }
  return { worst, os, osWho, bad: [...new Set(bad)], boss }; }
function l100(table) { const f = table[79]; let wins = 0, max = 0, os = 0, who = '';
  for (const s of [1, 2, 3]) { const r = fight(FX.teams['L100:Phil'], f.waves, s); if (r.won) wins++; if (r.h.max > max) { max = r.h.max; who = r.h.who; } os += r.h.os; }
  return { wins, max, os, who }; }
function climb(table) { const R = f => table[f - 1].recommendedPower, errs = [];
  let prevN = 0;   /* floors 1-59 keep their old-scale numbers (not part of v1372), so the climb is checked from floor 60 on */
  for (let f = 60; f <= 100; f++) { if (f % 5) { if (f > 61 && R(f) < prevN) errs.push('floor ' + f + ' ' + R(f) + ' < ' + prevN); prevN = R(f); }
    else { if (f > 60 && !(R(f) > R(f - 1))) errs.push('boss ' + f + ' not above floor ' + (f - 1)); if (f < 100 && !(R(f) > R(f + 1))) errs.push('boss ' + f + ' not above floor ' + (f + 1));
      if (f > 60 && R(f) > 1.6 * R(f - 1)) errs.push('boss ' + f + ' is a wall x' + (R(f) / R(f - 1)).toFixed(2)); } }
  for (let f = 60; f < 100; f++) if (R(f) >= R(100)) errs.push('floor ' + f + ' >= floor 100');
  return errs; }

// 1. benchmark one-shots
const b = benchScan(now);
ck('no floor 60-100 hits a benchmark non-tank for over 40% of the yardstick before the time ramp (worst ' + b.worst.abs + ' of ' + b.worst.Y + ' = ' + (b.worst.r * 100).toFixed(0) + '%, floor ' + b.worst.floor + ' ' + b.worst.who + ')', b.worst.r <= CAP, b.bad.join(', '));
ck('no full-HP benchmark hero dies to one hit before the time ramp (' + b.os + ')', b.os === 0, b.osWho.join(', '));
// 2. bosses threaten and are won by kill
const B = Object.entries(b.boss), dpf = B.reduce((s, [, x]) => s + x.deaths, 0) / B.reduce((s, [, x]) => s + x.n, 0);
ck('boss floors cost the benchmark heroes (' + dpf.toFixed(2) + ' deaths per fight, need >= ' + BOSS_DEATHS + ')', B.length === 9 && dpf >= BOSS_DEATHS);
const weak = B.filter(([, x]) => x.hit < BOSS_HIT * x.Y).map(([f, x]) => f + ' ' + Math.round(x.hit) + '/' + x.Y);
ck('every boss lands a pre-ramp hit of at least 15% of the yardstick', weak.length === 0, weak.join(', '));
const tmo = B.filter(([, x]) => x.tmo).map(([f, x]) => f + ' x' + x.tmo);
ck('no benchmark boss fight is lost on the wave timer', tmo.length === 0, tmo.join(', '));
// 3. Phil's level-100 team on Orryx
const p = l100(now);
ck('Phil\'s level-100 team clears floor 80 (Orryx) on every seed (' + p.wins + '/3)', p.wins === 3);
ck('no hero of Phil\'s level-100 team dies to one hit at floor 80 and no hit takes over 40% of its target (biggest ' + (p.max * 100).toFixed(0) + '% ' + p.who + ')', p.max <= 0.40 && p.os === 0);
// 4. the climb
const c = climb(now);
ck('recommendedPower climbs 60-100: normal floors never fall, bosses above both neighbours and <= 1.6x, floor 100 highest', c.length === 0, c.slice(0, 4).join('; '));
// 5. only the tuning numbers changed
ck('floors 1-59 untouched', now.slice(0, 59).every((f, i) => JSON.stringify(f) === JSON.stringify(old[i])));
const strip = f => JSON.stringify(Object.assign({}, f, { recommendedPower: 0, waves: f.waves.map(w => w.map(m => Object.assign({}, m, { hpMul: 0, dmgMul: 0 }))) }));
ck('floors 60-100 keep their monsters, levels, bosses, boss rules and rewards (only hpMul / dmgMul / recommendedPower move)', now.slice(59).every((f, i) => strip(f) === strip(old[59 + i])));
// CONTROL: the old table fails the same checks
const ob = benchScan(old.filter(f => f.floor === 80 || f.floor === 90 || f.floor === 93)), op = l100(old), oc = climb(old);
ck('CONTROL: ' + OLD_SHA + ' one-shots the benchmark (worst ' + (ob.worst.r * 100).toFixed(0) + '% of the yardstick ' + ob.worst.who + ', ' + ob.os + ' one-hit kills)', ob.worst.r > CAP && ob.os > 0);
ck('CONTROL: ' + OLD_SHA + ' Orryx hits Phil\'s level-100 team for over 40% (' + (op.max * 100).toFixed(0) + '% ' + op.who + ')', op.max > 0.40);
ck('CONTROL: ' + OLD_SHA + ' boss floors are walls (' + oc.length + ' climb errors)', oc.length > 0);
console.log('test_vault_curve_1372.js: ' + P + ' passed, ' + F + ' failed'); process.exit(F ? 1 : 0);
