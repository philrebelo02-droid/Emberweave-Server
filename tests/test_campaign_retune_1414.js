// v1414 (Phil 17 Nov 2026: "Clear at level, retune" / "if it wont make the game broken do it" / "the percentage win rate doesnt need to be
// the same, can be slightly higher then before"). Kimi's PvE retune: every campaign stage re-tuned with the game's own authoring tuner
// (tools/authoring/author_campaign_real.js) against the v1400 engine so an on-level team clears every chapter (validated 71-96% on
// 8 seeds); chapters 7-16 were 0-30%. Rule: Normal hpMul = pre-retune x d, dmgMul = pre-retune x d^0.7 (scaleWaves); no stage gets harder
// (d capped at 1 everywhere - Phil: the win rate may be slightly higher than before); Veteran / Elite keep their exact per-monster ratio to Normal; recommended power unchanged.
// Pre-retune data = git show 9e209bd0. CONTROL: a stage pushed off its d must be caught.
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
let P = 0, F = 0;
const ck = (n, c, x) => { if (c) { P++; console.log('  ok   ' + n); } else { F++; console.log('  FAIL ' + n + (x !== undefined ? ' - ' + JSON.stringify(x) : '')); } };
const D = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'campaign_retune_1414.json'), 'utf8')).d;
const cur = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'server', f), 'utf8'));
const old = f => JSON.parse(cp.execSync('git show 9e209bd0:server/' + f, { cwd: ROOT, maxBuffer: 64 << 20 }).toString());
const near = (a, b) => Math.abs(a - b) <= 2e-3 * Math.max(1, Math.abs(b));
const N = cur('campaign-encounters.json'), ON = old('campaign-encounters.json');
const on = Object.fromEntries(ON.map(s => [s.id, s])), nn = Object.fromEntries(N.map(s => [s.id, s]));
function offD(stages) { const bad = [];
  for (const s of stages) { const o = on[s.id], d = D[s.id];
    s.waves.forEach((w, wi) => w.forEach((m, mi) => { const q = o.waves[wi][mi];
      if (!near(m.hpMul, q.hpMul * d) || !near(m.dmgMul, q.dmgMul * Math.pow(d, 0.7))) bad.push(s.id + ' w' + wi + 'u' + mi); })); }
  return bad; }
ck('160 stages, each with a retune scalar', N.length === 160 && N.every(s => typeof D[s.id] === 'number' && D[s.id] > 0));
const bad = offD(N);
ck('Normal: every enemy is the pre-retune value x d (HP) / x d^0.7 (damage)', bad.length === 0, bad.slice(0, 6));
ck('chapter 1 is never harder than before (d <= 1)', N.filter(s => s.id.startsWith('1-')).every(s => D[s.id] <= 1));
ck('no stage is harder than before (every d <= 1)', N.every(s => D[s.id] <= 1));
ck('chapters 7-16 are easier on the whole (mean d < 0.8)', (a => a.reduce((x, y) => x + y, 0) / a.length)(N.filter(s => +s.id.split('-')[0] >= 7).map(s => D[s.id])) < 0.8);
ck('recommended power unchanged', N.every(s => s.recommendedPower === on[s.id].recommendedPower));
// v1429: tuneHp / tuneDmg are a later per-stage tune on top of the retune (16-10 Irix x1.2, tests/test_irix_wall_cauldron_1429.js) - not part of this check
// v1430: 16-10's companion hero was swapped for the tank Rhukk (companionSwap, tests/test_irix_final_boss_1430.js) - put the authored companion back for this check
/* v1452 (lockdown audit, glyphs line 21): the 21 fragment kinds no board uses were replaced in the reward tables (tests/fixtures/v1452_retired_fragments.json) -
   a retired kind in the pre-retune stage reads as what replaced it, so this check still compares everything else */
const RETIRED = new Set(require('./fixtures/v1452_retired_fragments.json').retired);
const unretire = (o, s) => { const c = JSON.parse(JSON.stringify(o)), gl = (c.rewards && c.rewards.glyphFragments) || [], nl = (s.rewards && s.rewards.glyphFragments) || [];
  gl.forEach((g, i) => { if (RETIRED.has(g.fragmentId) && nl[i]) { g.fragmentId = nl[i].fragmentId; g.key = nl[i].key; g.displayName = nl[i].displayName; } });
  if (RETIRED.has(c.farmFragment)) c.farmFragment = s.farmFragment; return c; };
const unswap = s => { if (!s.companionSwap) return s; const c = JSON.parse(JSON.stringify(s)), sw = c.companionSwap; delete c.companionSwap;
  c.waves = c.waves.map(w => w.map(u => (u.isHero && u.key === sw.in && !u.rewardHero) ? { key: sw.out, lvl: u.lvl, hpMul: u.hpMul, dmgMul: u.dmgMul, isHero: true, rewardHero: true, rank: u.rank } : u)); return c; };
ck('waves, monsters, bosses and rewards unchanged - only hpMul / dmgMul / difficultyTune moved',
  N.every(s => { const o = on[s.id]; const strip = x => JSON.stringify(x, (k, v) => (k === 'hpMul' || k === 'dmgMul' || k === 'difficultyTune' || k === 'tuneHp' || k === 'tuneDmg' || k === 'addedFragments' || k === 'fragmentKinds') ? undefined : v);   /* v1457: fragmentKinds = Phil's 26 Nov stage lists (1-2 stages per kind per portal, tests/test_phil_answers_1457.js) */ return strip(unswap(s)) === strip(unretire(o, s)); }));
for (const f of ['veteran-campaign-encounters.json', 'elite-campaign-encounters.json']) {
  const V = cur(f), OV = Object.fromEntries(old(f).map(s => [s.id, s])), b = [];
  for (const v of V) { const o = OV[v.id], n = nn[v.id], q = on[v.id];
    v.waves.forEach((w, wi) => w.forEach((m, mi) => { const om = o.waves[wi][mi], nm = n.waves[wi][mi], qm = q.waves[wi][mi];
      if (!near(m.hpMul / nm.hpMul, om.hpMul / qm.hpMul) || !near(m.dmgMul / nm.dmgMul, om.dmgMul / qm.dmgMul)) b.push(v.id + ' w' + wi + 'u' + mi); })); }
  ck(f + ': keeps its exact per-monster ratio to Normal', b.length === 0, b.slice(0, 6));
}
{ const V = cur('veteran-campaign-encounters.json');
  ck('Veteran stays exactly Normal x2 (HP)', V.every(v => v.waves.every((w, wi) => w.every((m, mi) => near(m.hpMul, nn[v.id].waves[wi][mi].hpMul * 2))))); }
{ // CONTROL: push 9-5 off its d
  const copy = JSON.parse(JSON.stringify(N)); const s = copy.find(x => x.id === '9-5'); s.waves[0][0].hpMul *= 1.5;
  ck('CONTROL: a stage pushed off its retune scalar is caught', offD(copy).length > 0); }
console.log('test_campaign_retune_1414.js: ' + P + ' passed, ' + F + ' failed');
process.exit(F ? 1 : 0);
