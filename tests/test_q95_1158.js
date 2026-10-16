'use strict';
// v1158 q95 (Phil 15 Oct 2026: "q95, ship it after condense"). tests/fixtures/q95_1158.json lists every sheet re-encoded. This test:
//   1. COVERAGE: every sheet the page or the tier table names that was LOSSLESS in v1157 (BASE) is in the fixture or in kept_lossless
//      (q95 came out bigger); no LOSSY sheet was touched; the only asset files that differ from BASE are the fixture's + the tier table.
//   2. FILES: each q95 file = the fixture's sha256, lossy WebP (VP8 + ALPH), the same W x H as its BASE file, smaller than it; its BASE
//      file = the fixture's old sha256 and was lossless. kept_lossless files are byte-identical to BASE.
//   3. PIXELS (python, every sheet): alpha decodes BIT-EXACT to the BASE file; composited over the battle floor PSNR >= 29 dB;
//      Kon-Wu's blue sheet carries no green under alpha 0 (BASE did). CONTROL: one alpha value nudged fails the alpha check.
//   4. URLS: every page / tier-table URL of a q95 sheet is ?v=1158 and none keeps its old ?v=; ART_TIERS_URL is ?v=1158; with the
//      q95 URLs put back the page is BASE's byte for byte apart from the build stamp (so nothing else changed - fights cannot move).
(function main() {
const path = require('path'), fs = require('fs'), cp = require('child_process'), os = require('os');
const ROOT = path.resolve(__dirname, '..');
const Q = require('./helpers/q95-1158.js'), FIX = Q.Q95, BASE = process.env.EW_BASE || FIX.base;
const PY = process.env.PYTHON || 'python';
/* v1159: the two 'nothing else changed' checks are about the v1158 RELEASE, so they read the v1158 commit (REL) when the tree is later - a later
   release that adds files (v1159 music) or changes the page must not fail them. A flat bundle without git history uses the tree as before. */
const REL = process.env.EW_REL || '102a8bfefd5e7d03f0938f172fb178e921427038';
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + String(detail).slice(0, 600) : '')); } };
const git = (...a) => cp.execFileSync('git', a, { cwd: ROOT, maxBuffer: 512 << 20 });
const chunks = b => { const o = []; let i = 12; while (i + 8 <= b.length) { const t = b.toString('ascii', i, i + 4), n = b.readUInt32LE(i + 4); o.push(t); i += 8 + n + (n & 1); } return o; };
const kindOf = b => { const c = chunks(b); return c.includes('ANIM') ? 'animated' : c.includes('VP8L') ? 'lossless' : c.includes('VP8 ') ? 'lossy' : '?'; };
const dims = b => { const t = b.toString('ascii', 12, 16);
  if (t === 'VP8L') { const v = b.readUInt32LE(21); return [(v & 0x3fff) + 1, ((v >> 14) & 0x3fff) + 1]; }
  if (t === 'VP8X') return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (t === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff]; return null; };
const sha = b => require('crypto').createHash('sha256').update(b).digest('hex');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-q95t-')); process.on('exit', () => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });
try {
  const page = fs.readFileSync(path.join(ROOT, 'emberweave-heroes.html'), 'utf8'), tiers = fs.readFileSync(path.join(ROOT, 'assets/anim/tiers_1141.json'), 'utf8');
  const bPage = git('show', BASE + ':emberweave-heroes.html').toString(), bTiers = git('show', BASE + ':assets/anim/tiers_1141.json').toString();
  // ------------------------------------------------ 1. COVERAGE
  const named = new Set(); for (const m of (bPage + bTiers).matchAll(/\/assets\/anim\/[A-Za-z0-9_\-/.]+?\.webp(?=\?v=)/g)) named.add(m[0]);
  const fx = new Set(FIX.sheets.map(e => e.path)), kept = new Set(FIX.kept_lossless.map(e => e.path));
  const lossless = [], miss = [];
  for (const p of named) { let b; try { b = git('show', BASE + ':' + p.slice(1)); } catch (e) { miss.push(p); continue; } if (kindOf(b) === 'lossless') lossless.push(p); }
  ck('every BASE sheet named with a ?v= exists in BASE (' + named.size + ')', miss.length === 0, miss.slice(0, 5).join(','));
  ck('every lossless sheet BASE names (' + lossless.length + ') is re-encoded (' + fx.size + ') or kept because q95 was bigger (' + kept.size + '); nothing else is in the fixture',
    lossless.every(p => fx.has(p) || kept.has(p)) && [...fx, ...kept].every(p => lossless.includes(p)) && fx.size + kept.size === lossless.length);
  let relOk = false; try { git('cat-file', '-e', REL + '^{commit}'); relOk = true; } catch (e) {}
  const relPage = relOk ? git('show', REL + ':emberweave-heroes.html').toString() : page, relTiers = relOk ? git('show', REL + ':assets/anim/tiers_1141.json').toString() : tiers;
  const changed = git(...['diff', '--name-only', '--no-renames', BASE].concat(relOk ? [REL] : []).concat(['--', 'assets'])).toString().split(/\r?\n/).filter(Boolean).map(x => '/' + x);
  const extra = changed.filter(p => !fx.has(p) && p !== '/assets/anim/tiers_1141.json');
  ck('the only asset files that differ from BASE are the ' + fx.size + ' q95 sheets and the tier table (' + changed.length + ' changed)', extra.length === 0 && fx.size + 1 === changed.length && FIX.sheets.every(e => changed.includes(e.path)), extra.slice(0, 5).join(','));
  // ------------------------------------------------ 2. FILES
  const bad = [];
  for (const e of FIX.sheets) { const n = fs.readFileSync(path.join(ROOT, e.path.slice(1))), o = git('show', BASE + ':' + e.path.slice(1));
    if (sha(n) !== e.new_sha256) bad.push(e.path + ' sha'); if (sha(o) !== e.old_sha256) bad.push(e.path + ' base sha');
    if (kindOf(n) !== 'lossy' || !chunks(n).includes('ALPH')) bad.push(e.path + ' not lossy+alpha'); if (kindOf(o) !== 'lossless') bad.push(e.path + ' base not lossless');
    const dn = dims(n), dO = dims(o); if (!dn || !dO || dn[0] !== dO[0] || dn[1] !== dO[1] || dn[0] !== e.w || dn[1] !== e.h) bad.push(e.path + ' size ' + dn + ' vs ' + dO);
    if (!(n.length < o.length) || n.length !== e.new_bytes || o.length !== e.old_bytes) bad.push(e.path + ' not smaller'); }
  for (const e of FIX.kept_lossless) { const n = fs.readFileSync(path.join(ROOT, e.path.slice(1))), o = git('show', BASE + ':' + e.path.slice(1)); if (!n.equals(o) || e.q95_bytes <= e.old_bytes) bad.push(e.path + ' kept file changed / q95 was not bigger'); }
  const ob = FIX.sheets.reduce((a, e) => a + e.old_bytes, 0), nb = FIX.sheets.reduce((a, e) => a + e.new_bytes, 0);
  ck('every q95 file: fixture sha, lossy WebP with alpha, same W x H as BASE, smaller (' + (ob / 1e6).toFixed(1) + ' -> ' + (nb / 1e6).toFixed(1) + ' MB); kept files = BASE', bad.length === 0, bad.slice(0, 6).join('; '));
  // ------------------------------------------------ 3. PIXELS
  const jobs = FIX.sheets.map((e, i) => { const bf = path.join(TMP, i + '.webp'); fs.writeFileSync(bf, git('show', BASE + ':' + e.path.slice(1))); return { p: e.path, b: bf, n: path.join(ROOT, e.path.slice(1)), z: FIX.zero_hidden.includes(e.path) }; });
  const PYS = [
    'import sys, json',
    'import numpy as np',
    'from PIL import Image',
    'J = json.load(open(sys.argv[1])); BG = np.array([38, 34, 46], np.float32); out = []',
    'def comp(a):',
    '    al = a[..., 3:4].astype(np.float32) / 255; return a[..., :3].astype(np.float32) * al + BG * (1 - al)',
    'def g(x): return int(((x[..., 3] == 0) & (x[..., 1].astype(int) > np.maximum(x[..., 0], x[..., 2]).astype(int) + 24)).sum())',
    'def gv(x): return int(((x[..., 3] > 0) & (x[..., 1].astype(int) > np.maximum(x[..., 0], x[..., 2]).astype(int) + 24)).sum())',
    'for j in J:',
    "    a = np.asarray(Image.open(j['b']).convert('RGBA')); d = np.asarray(Image.open(j['n']).convert('RGBA'))",
    "    if j.get('poke'):",
    '        d = d.copy(); ys, xs = np.nonzero(d[..., 3] > 0); d[ys[0], xs[0], 3] ^= 1',
    '    ax = bool(a.shape == d.shape and np.array_equal(a[..., 3], d[..., 3]))',
    '    vis = a[..., 3] > 0; mse = float(((comp(a) - comp(d)) ** 2)[vis].mean()) if vis.any() else 0.0',
    '    ps = 99.0 if mse == 0 else float(10 * np.log10(255 * 255 / mse))',
    "    out.append([j['p'], ax, round(ps, 2), g(a) if j['z'] else None, g(d) if j['z'] else None, gv(a) if j['z'] else None, gv(d) if j['z'] else None])",
    'print(json.dumps(out))'].join('\n');
  fs.writeFileSync(path.join(TMP, 'px.py'), PYS); fs.writeFileSync(path.join(TMP, 'jobs.json'), JSON.stringify(jobs));
  const R = JSON.parse(cp.execFileSync(PY, ['-I', path.join(TMP, 'px.py'), path.join(TMP, 'jobs.json')], { maxBuffer: 64 << 20 }).toString());
  const aBad = R.filter(r => !r[1]), lowQ = R.filter(r => r[2] < 29); R.sort((x, y) => x[2] - y[2]);
  ck('ALPHA: every q95 sheet decodes to the BASE alpha bit for bit (' + R.length + ' sheets)', R.length === FIX.sheets.length && aBad.length === 0, aBad.slice(0, 5).map(r => r[0]).join(','));
  ck('QUALITY: composited over the battle floor every sheet is >= 29 dB (worst ' + R[0][0] + ' ' + R[0][2] + ' dB, median ' + R[R.length >> 1][2] + ')', lowQ.length === 0, lowQ.slice(0, 5).map(r => r[0] + ' ' + r[2]).join(','));
  const kw = R.find(r => r[3] != null);
  /* the encoder may put any colour under alpha 0 (exact off; never drawn - the browser premultiplies), so the hidden count is not 0; what matters is
     that the green leak is gone from the data it encodes and no VISIBLE green is added */
  ck('Kon-Wu blue: hidden green under alpha 0 cut >= 99.9% (BASE ' + (kw && kw[3]) + ' px -> ' + (kw && kw[4]) + '), visible green px within 1% of BASE (' + (kw && kw[5]) + ' -> ' + (kw && kw[6]) + ')',
    !!kw && kw[3] > 0 && kw[4] <= kw[3] * 0.001 && kw[6] <= kw[5] * 1.01);
  { fs.writeFileSync(path.join(TMP, 'ctl.json'), JSON.stringify([Object.assign({}, jobs[0], { poke: 1 })]));
    const c = JSON.parse(cp.execFileSync(PY, ['-I', path.join(TMP, 'px.py'), path.join(TMP, 'ctl.json')]).toString());
    ck('CONTROL: one alpha value nudged fails the alpha check', c[0][1] === false); }
  // ------------------------------------------------ 4. URLS
  const both = page + tiers, uBad = [];
  const esc = s => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  const RETIRED = new Set(['/assets/anim/fx/vael_ult.webp']);   // v1168: replaced in place by vael_last_stand_16oct.webp (the file stays on disk; tests/test_vael_fx_1168.js)
  for (const e of FIX.sheets) { if (!both.includes(e.path + '?v=1158') && !RETIRED.has(e.path)) uBad.push(e.path + ' has no ?v=1158 URL');
    for (const m of both.matchAll(new RegExp(esc(e.path) + '\\?v=([A-Za-z0-9_.-]+)', 'g'))) if (m[1] !== '1158') uBad.push(e.path + ' ?v=' + m[1]); }
  ck('every page and tier-table URL of a q95 sheet is ?v=1158, none keeps its old ?v=', uBad.length === 0, uBad.slice(0, 5).join('; '));
  ck("ART_TIERS_URL is ?v=1158 (the tier table's bytes changed)", page.includes("ART_TIERS_URL='/assets/anim/tiers_1141.json?v=1158'"));
  const norm = s => s.split(String.fromCharCode(13, 10)).join(String.fromCharCode(10)).replace(/const BUILD_ID = '\d+';/, "const BUILD_ID = 'X';").replace("tiers_1141.json?v=1158'", "tiers_1141.json?v=1141'");
  ck('with the q95 URLs put back the page is BASE byte for byte (apart from the build stamp) and the tier table is BASE\'s', norm(Q.undoText(relPage)) === norm(bPage) && norm(Q.undoText(relTiers)) === norm(bTiers));
  ck('CONTROL: one URL left at ?v=1158 breaks that equality', norm(Q.undoText(relPage).replace(FIX.sheets[0].path + FIX.sheets[0].old_v, FIX.sheets[0].path + '?v=1158')) !== norm(bPage));
} catch (e) { fail++; console.log('  FAIL threw: ' + (e && e.stack || e)); }
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exitCode = fail ? 1 : 0;
})();
