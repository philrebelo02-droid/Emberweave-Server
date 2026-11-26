// node rebalance.js ROOT  — v1457 (Phil 26 Nov: "each glyph should have 1-2 stages per normal, elite, and veteran").
// Rewrites rewards.fragmentKinds (the stage's v1457 list; glyphFragments stays as older builds read it) so that, within each mode and quality band,
// every fragment kind drops from 1-2 stages; Normal kinds each keep >=1 ORDINARY stage. Keeps as many existing (stage, kind) pairs as it can.
'use strict';
const fs = require('fs'), path = require('path'), R = process.argv[2];
const raw = JSON.parse(fs.readFileSync(path.join(R, 'server/glyph-source.json'), 'utf8')), FR = /^(\d+)\s*[×x]\s*(.+?)\s+Fragments$/, KIND = new Set();
for (const d of raw) for (const p of d.recipeText.split(' + ')) { const m = FR.exec(p.trim()); if (m) KIND.add(m[2]); }
const q = k => k.slice(0, k.lastIndexOf(' ')), slug = k => k.toLowerCase().replace(/\s*\+\s*/g, '-plus-').replace(/\s+/g, '-');
const LAD = ['Grey', 'Green', 'Green +1', 'Blue', 'Blue +1', 'Blue +2', 'Purple', 'Purple +1', 'Purple +2', 'Purple +3', 'Gold', 'Gold +1', 'Gold +2', 'Gold +3', 'Gold +4', 'Orange'];
const FILES = { normal: ['campaign-encounters.json', 2], elite: ['elite-campaign-encounters.json', 1], veteran: ['veteran-campaign-encounters.json', 1] };
const report = { before: {}, after: {}, unplaced: [] };
const cur = e => (e.rewards.fragmentKinds || e.rewards.glyphFragments.concat(e.rewards.addedFragments || [])).map(f => f.key);
function band(mode, stages, kinds) {
  const ord = s => mode === 'normal' && (s.rewards.fragmentRolls | 0) === 2;
  const n = kinds.length, now = stages.reduce((a, s) => a + cur(s).length, 0);
  const minT = stages.reduce((a, s) => a + (ord(s) ? 2 : 1), 0), maxT = stages.reduce((a, s) => a + (ord(s) ? 5 : 3), 0);
  let T = mode === 'normal' ? Math.min(now, 2 * n) : Math.max(stages.length, n);
  T = Math.max(minT, Math.min(maxT, Math.max(n, Math.min(2 * n, T))));
  if (T < n || T > 2 * n) throw new Error(mode + ' ' + q(kinds[0]) + ': no 1-2 layout (' + n + ' kinds, slots ' + minT + '-' + maxT + ')');
  // stage sizes
  const size = new Map(stages.map(s => [s, mode === 'normal' ? (ord(s) ? 4 : 1) : 1]));
  let tot = () => [...size.values()].reduce((a, b) => a + b, 0);
  const os = stages.filter(ord), ss = stages.filter(s => !ord(s));
  for (let i = 0; tot() > T; i++) { const s = os[os.length - 1 - (i % os.length)]; if (size.get(s) > 2) size.set(s, size.get(s) - 1); else if (i > 50) throw new Error('shrink'); }
  for (let i = 0; tot() < T; i++) { const pool = mode === 'normal' ? os : ss, s = pool[(i * 7) % pool.length]; if (size.get(s) < (ord(s) ? 5 : 2)) size.set(s, size.get(s) + 1); else if (i > 400) { const t = ss.find(x => size.get(x) < 3); if (!t) throw new Error('grow'); size.set(t, size.get(t) + 1); } }
  // quotas: 1 each; extras first to kinds on a Normal single stage (they need a single AND an ordinary), then to kinds with more current stages
  const was = k => stages.filter(s => cur(s).includes(k)).length, onSingle = k => mode === 'normal' && ss.some(s => cur(s)[0] === k);
  const quota = new Map(kinds.map(k => [k, 1])); let extra = T - n;
  for (const k of [...kinds].sort((a, b) => (onSingle(b) - onSingle(a)) || (was(b) - was(a)) || kinds.indexOf(a) - kinds.indexOf(b))) { if (extra <= 0) break; quota.set(k, 2); extra--; }
  const lists = new Map(stages.map(s => [s, []])), left = new Map(quota);
  const put = (s, k) => { if (lists.get(s).length >= size.get(s) || lists.get(s).includes(k) || !(left.get(k) > 0)) return false; lists.get(s).push(k); left.set(k, left.get(k) - 1); return true; };
  // 1. a single stage keeps its own kind
  for (const s of ss) { const k = cur(s)[0]; if (!(mode === 'normal' && left.get(k) < 2)) put(s, k); }
  // 2. Normal: every kind one ORDINARY stage - where it already is if possible
  if (mode === 'normal') for (const k of kinds) if (!os.some(s => lists.get(s).includes(k))) { if (!(left.get(k) > 0)) { left.set(k, 1); quota.set(k, quota.get(k) + 1); }
    const s = os.find(x => cur(x).includes(k) && lists.get(x).length < size.get(x)) || os.filter(x => lists.get(x).length < size.get(x) && !lists.get(x).includes(k)).sort((a, b) => lists.get(a).length - lists.get(b).length)[0]; if (!s || !put(s, k)) throw new Error('no ordinary slot for ' + k); }
  // 3. keep the other existing pairs, then 4. fill
  for (const s of stages) for (const k of cur(s)) put(s, k);
  for (const s of stages) while (lists.get(s).length < size.get(s)) { const k = kinds.filter(x => left.get(x) > 0 && !lists.get(s).includes(x)).sort((a, b) => left.get(b) - left.get(a))[0];
    if (!k) { // repair: borrow a kind from a stage that holds more than one and give it here, then hand that stage a free one
      const kk = kinds.find(x => left.get(x) > 0); if (!kk) throw new Error('fill ' + s.id); const d = stages.find(o => o !== s && lists.get(o).length > (ord(o) ? 2 : 1) && lists.get(o).some(x => !lists.get(s).includes(x)) && !lists.get(o).includes(kk));
      if (!d) throw new Error('repair ' + s.id); const mv = lists.get(d).find(x => !lists.get(s).includes(x)); lists.get(d).splice(lists.get(d).indexOf(mv), 1, kk); left.set(kk, left.get(kk) - 1); lists.get(s).push(mv); continue; }
    put(s, k); }
  for (const k of kinds) { const c = stages.filter(s => lists.get(s).includes(k)).length; if (c < 1 || c > 2) throw new Error(k + ' on ' + c + ' ' + mode + ' stages'); }
  return lists;
}
for (const [mode, [file, ind]] of Object.entries(FILES)) {
  const p = path.join(R, 'server', file), t = fs.readFileSync(p, 'utf8'), L = JSON.parse(t);
  if (JSON.stringify(L, null, ind).replace(/\n/g, '\r\n') !== t) throw new Error(file + ': format');
  const cnt = m => { const c = {}; for (const k of KIND) c[k] = 0; for (const e of L) for (const k of m(e)) c[k]++; const b = { zero: 0, ok: 0, over: 0 }; for (const k of KIND) b[!c[k] ? 'zero' : c[k] <= 2 ? 'ok' : 'over']++; return b; };
  report.before[mode] = cnt(e => e.rewards.glyphFragments.map(f => f.key));
  for (const Q of LAD) { const st = L.filter(e => q(e.rewards.glyphFragments[0].key) === Q), kinds = [...KIND].filter(k => q(k) === Q);
    if (!st.length) { report.unplaced.push(mode + ' ' + Q + ' (' + kinds.length + ' kinds): ' + mode + ' has no ' + Q + ' stage'); continue; }
    const lists = band(mode, st, kinds);
    for (const s of st) { const qty = s.rewards.glyphFragments[0].quantity, rolls = (s.rewards.fragmentRolls | 0) === 2, ks = lists.get(s);
      delete s.rewards.addedFragments; delete s.rewards.fragmentKinds;
      if (JSON.stringify(ks) !== JSON.stringify(s.rewards.glyphFragments.map(f => f.key)))
        s.rewards.fragmentKinds = ks.map(k => Object.assign({ fragmentId: slug(k), key: k, displayName: k + ' Fragment', quantity: qty }, rolls ? { possible: true } : {})); } }
  report.after[mode] = cnt(e => (e.rewards.fragmentKinds || e.rewards.glyphFragments).map(f => f.key));
  fs.writeFileSync(p, JSON.stringify(L, null, ind).replace(/\n/g, '\r\n'));
}
console.log(JSON.stringify(report, null, 1));
