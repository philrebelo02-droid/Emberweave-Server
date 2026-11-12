// v1372 (Phil 11 Nov 2026: "nerf the stages that are clearly imbalanced, make the climb more gradual not instant"; testers: Normal 1-7 and 1-10 walls,
// 1-8 / 1-9 too hard). Normal 1-7..1-10 enemy HP cut first, damage kept >= 0.80x (HP x / damage x below); Elite takes the same factors (stays Normal x1.5),
// Veteran = exactly Normal x2. recommendedPower 1-7..1-10 raised to the measured team that wins them (capped at 2-1 so the curve never goes backwards).
// Every other stage of all three tables is byte-for-byte the c8d8f962 value.
// Curve proof in the REAL engine (server/sim-host.js -> simCampaignReplay, Affinities ON as live): one fixed ruler team (Normal-account ladder rung at
// level 10, tests/fixtures/stage_curve_1372_team.json, 5 line-ups x 8 seeds) against each stage with every enemy x a probe multiplier. K = the multiplier
// at which that team wins half its fights on the v1372 table (measured with the same seeds, _scr ruler.js): the higher K, the easier the stage.
// CONTROL: the c8d8f962 table must fail the pins and the cliff / seam probes.
const fs = require('fs'), path = require('path'), cp = require('child_process'), vm = require('vm');
const ROOT = path.join(__dirname, '..'), BASE = 'c8d8f962';
let P = 0, F = 0;
const ck = (n, c, x) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n + (x !== undefined ? ' - ' + JSON.stringify(x) : '')); } };
const FILES = { normal: 'campaign-encounters.json', elite: 'elite-campaign-encounters.json', veteran: 'veteran-campaign-encounters.json' };
const cur = f => JSON.parse(fs.readFileSync(path.join(process.env.EW_STAGE_ENC_DIR || path.join(ROOT, 'server'), f), 'utf8'));
const old = f => JSON.parse(cp.execSync('git show ' + BASE + ':server/' + f, { cwd: ROOT, maxBuffer: 64 << 20 }).toString());
const K = { '1-7': { h: 0.117, d: 0.8, rp: 2012 }, '1-8': { h: 0.188, d: 0.8, rp: 2071 }, '1-9': { h: 0.225, d: 0.8, rp: 2103 }, '1-10': { h: 0.386, d: 0.9, rp: 2103 } };
const near = (a, b) => Math.abs(a - b) <= 6e-5 + 1e-4 * Math.abs(b);

// ---- data pins ----
const T = {}; for (const m in FILES) T[m] = { cur: cur(FILES[m]), old: old(FILES[m]) };
function pinProblems(mode, N) { const O = T[mode].old, om = Object.fromEntries(O.map(s => [s.id, s])), bad = [];
  const nN = mode === 'veteran' ? Object.fromEntries(T.normal.cur.map(s => [s.id, s])) : null;
  if (N.length !== O.length) bad.push('count');
  for (const s of N) { const o = om[s.id], f = K[s.id];
    if (!f) { if (JSON.stringify(s) !== JSON.stringify(o)) bad.push(s.id + ' moved'); continue; }
    s.waves.forEach((w, wi) => w.forEach((m, mi) => { const q = o.waves[wi][mi];
      const eh = mode === 'veteran' ? nN[s.id].waves[wi][mi].hpMul * 2 : q.hpMul * f.h, ed = mode === 'veteran' ? nN[s.id].waves[wi][mi].dmgMul * 2 : q.dmgMul * f.d;
      if (!near(m.hpMul, eh) || !near(m.dmgMul, ed)) bad.push(s.id + ' w' + wi + 'u' + mi);
      if (m.dmgMul < 0.8 * q.dmgMul - 1e-4) bad.push(s.id + ' dmg under 0.80x'); }));
    const erp = { normal: f.rp, elite: Math.round(1.5 * f.rp), veteran: 2 * f.rp }[mode];
    if (Math.abs(s.recommendedPower - erp) > 1) bad.push(s.id + ' rp ' + s.recommendedPower + ' != ' + erp); }
  return [...new Set(bad)]; }
for (const m in FILES) { const b = pinProblems(m, T[m].cur); ck(m + ': 1-7..1-10 carry the v1372 factors and power; every other stage is the ' + BASE + ' value', b.length === 0, b.slice(0, 6)); }
for (const m in FILES) ck('CONTROL ' + m + ': the ' + BASE + ' table fails the pins', pinProblems(m, T[m].old).length > 0);
for (const m in FILES) { const S = T[m].cur.slice().sort((a, b) => a.node - b.node);
  ck(m + ': recommended power never goes backwards', S.every((e, i) => i === 0 || e.recommendedPower >= S[i - 1].recommendedPower)); }
{ const st = x => x.waves.reduce((t, w) => t + w.reduce((a, u) => a + Math.sqrt(u.hpMul * u.dmgMul) * (1 + 0.05 * u.lvl), 0), 0), N = T.normal.cur, E = T.elite.cur;
  ck('Elite 1-7..1-10 stay 1.5x their Normal stage (test_farm_map measure)', Object.keys(K).every(id => Math.abs(st(E.find(s => s.id === id)) / st(N.find(s => s.id === id)) - 1.5) < 0.01)); }

// ---- Bonus 1-6 is not a side effect (coordinator 12 Nov): its boss (Brukk, read off Normal 1-10) keeps the c8d8f962 numbers ----
{ const B = require(path.join(ROOT, 'server', 'bonus-stages.js')), N = T.normal.cur, O = T.normal.old;
  const ob = O.find(s => s.id === '1-10').waves.flat().find(m => m.boss), nb = N.find(s => s.id === '1-10').waves.flat().find(m => m.boss), bf = B.bossFor(N, 1);
  ck('Bonus 1-6 boss = the c8d8f962 1-10 boss (' + ob.key + ' hpMul ' + ob.hpMul + ' dmgMul ' + ob.dmgMul + ')', bf && bf.key === ob.key && bf.lvl === ob.lvl && bf.hpMul === ob.hpMul && bf.dmgMul === ob.dmgMul, bf);
  const lanes = t => JSON.stringify([3, 4, 6, 7, 9, 10].map(s => B.buildLanes(t, 1, s)));
  ck('every chapter 1 bonus stage builds exactly the lanes it built on the c8d8f962 table (Bonus 1-6 boss HP ' + (JSON.stringify(B.buildLanes(N, 1, 6)).match(/"key":"brukk","lvl":\d+,"hpMul":([\d.]+)/) || [])[1] + ')', lanes(N) === lanes(O));
  ck('CONTROL: without the pin the bonus boss would follow the v1372 1-10 cut (hpMul ' + nb.hpMul + ' != ' + ob.hpMul + ')', !near(nb.hpMul, ob.hpMul)); }

// ---- the curve in the real engine ----
const html = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8');
const tmp = path.join(ROOT, '.stage_curve_1372_' + process.pid + '.html');
const flag = /const AFFINITIES_LIVE=(true|false);/;
if (!flag.test(html)) { ck('the page has the AFFINITIES_LIVE switch', false); }
else {
  fs.writeFileSync(tmp, html.replace(flag, 'const AFFINITIES_LIVE=true;'));   // the curve was measured with Affinities ON (the live rules)
  let host; try { host = require(path.join(ROOT, 'server', 'sim-host.js')).load(tmp); } finally { try { fs.unlinkSync(tmp); } catch (e) {} }
  vm.runInContext('autoUlt=true;', host.ctx); const SB = host.sandbox;
  const TEAM = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'stage_curve_1372_team.json'), 'utf8'));
  const SN = {}; for (const k in TEAM.specs) SN[k] = JSON.stringify(host.snapFromSpecs([TEAM.specs[k]])[0]);
  const COMPS = [['vael', 'sylthaine', 'vireo', 'tick', 'fritz'], ['askel', 'rivet', 'mirelle', 'aureth', 'sloe'], ['gruel', 'yenna', 'dandra', 'carn', 'astra'],
    ['brannus', 'orryn', 'nerisse', 'joss', 'umbris'], ['hobb', 'kharos', 'linnet', 'nox', 'lysara']];
  const wins = (table, id, k) => { const st = table.find(s => s.id === id), size = st.node <= 3 ? 3 : st.node <= 6 ? 4 : 5, w = 0;
    const waves = st.waves.map(wv => wv.map(m => Object.assign({}, m, { hpMul: m.hpMul * k, dmgMul: m.dmgMul * k }))); let n = 0, won = 0;
    COMPS.forEach((full, ci) => { const hs = full.slice(0, size); for (let s = 0; s < 8; s++) { n++;
      if (SB.simCampaignReplay(hs.map(x => JSON.parse(SN[x])), JSON.parse(JSON.stringify(waves)), (7007 + s * 7919 + st.node * 131 + ci * 17) >>> 0, [], false)) won++; } });
    return won / n; };
  const KS = { '1-6': 5.618, '1-7': 4.714, '1-8': 3.73, '1-9': 3.13, '1-10': 2.506, '2-1': 2.565, '2-5': 2.127 };   // measured K on the v1372 table
  const N = T.normal.cur, O = T.normal.old;
  const chain = ['1-6', '1-7', '1-8', '1-9', '1-10'];
  for (let i = 1; i < chain.length; i++) { const a = chain[i - 1], b = chain[i];
    const r1 = wins(N, a, KS[b]); ck('climb: ' + a + ' is no harder than ' + b + ' (' + a + ' wins ' + Math.round(100 * r1) + '% at ' + b + "'s K " + KS[b] + ')', r1 >= 0.5, r1);
    const x = KS[a] / 1.4, r2 = wins(N, b, x); ck('no cliff: ' + b + ' is at most 1.4x harder than ' + a + ' (' + b + ' wins ' + Math.round(100 * r2) + '% at ' + x.toFixed(3) + ')', r2 >= 0.5, r2); }
  const s1 = wins(N, '1-9', KS['2-1']); ck('seam: 2-1 opens no easier than 1-9 (1-9 wins ' + Math.round(100 * s1) + '% at 2-1\'s K)', s1 >= 0.5, s1);
  const s2 = wins(N, '1-10', KS['2-5']); ck('seam: by 2-5 chapter 2 is as hard as the 1-10 boss (1-10 wins ' + Math.round(100 * s2) + '% at 2-5\'s K)', s2 >= 0.5, s2);
  const c1 = wins(O, '1-7', KS['1-6'] / 1.4); ck('CONTROL: on ' + BASE + ' 1-7 is a cliff after 1-6 (wins ' + Math.round(100 * c1) + '%)', c1 < 0.5, c1);
  const c2 = wins(O, '1-9', KS['2-1']); ck('CONTROL: on ' + BASE + ' 1-9 is harder than 2-1 (wins ' + Math.round(100 * c2) + '%)', c2 < 0.5, c2);
  const c3 = wins(O, '1-10', KS['2-5']); ck('CONTROL: on ' + BASE + ' 1-10 is harder than 2-5 (wins ' + Math.round(100 * c3) + '%)', c3 < 0.5, c3);
}
console.log('test_stage_curve_1372.js: ' + P + ' passed, ' + F + ' failed');
process.exit(F ? 1 : 0);
