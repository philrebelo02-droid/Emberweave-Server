'use strict';
// v1141 CONDENSE (Phil 15 Oct 2026, approved items 1 / 4 / 5 / 7: "make the game smaller without lowering quality"; NOT approved and NOT
// done: GPU-compressed textures, lossy re-encodes, lower-bitrate sound). This test:
//   1. TABLE + FILES: assets/anim/tiers_1141.json - every tier file exists, is LOSSLESS WebP, decodes to the declared W x H, holds its cells
//      in the declared grid; a PHONE file is <= 2048 px / 4 MB (the v1140 ratchet), no bigger a download than the original and never more
//      texture memory than the v1140 phone budget uploads for that sheet, and shows at least as many figure px as v1140; a HIGH (trimmed)
//      file is a crop of a frozen oversize original, smaller in both sides and bytes; idle / walk are never tiered.
//   2. TRIM CORRECTNESS: tools/condense_verify.py - every cell of every tier file, put back at its tc rectangle, is PIXEL-IDENTICAL to the
//      untrimmed cell at the same tier (high: checked against the original file itself; phone: against the cell manifest, and 8 sheets
//      re-resampled from source); CONTROL: one nudged pixel fails.
//   3. CLIP DATA UNCHANGED: every BATTLE_ANIM / FX2_DEF entry (cells, timing, anchors, contact frames) is byte-identical to BASE (v1153 since v1154).
//   4. TIER PICK (real browser): an 844x390 phone -> 'phone'; 1920x1080 desktop, a 1180x820 tablet -> 'high'; a desktop reporting
//      deviceMemory 2 -> 'phone'; localStorage ew_art_tier overrides. A phone fight loads the phone files (decoded at exactly W x H: no
//      second resize), a desktop fight the trimmed/original files; only the fighters' sheets are fetched; going home frees them.
//   5. PLACEMENT: for a trimmed clip the drawn quad, expanded by tc, is the logical cell the untrimmed sheet draws (same anchor, both facings).
//   6. TICK-IDENTICAL: the same seeded fight driven frame by frame on the phone tier and the high tier gives the same hp/x/y/alive every
//      frame for 600 frames (the sim never reads a texture).
//   7. COMPRESSION: /play, JS and JSON go out brotli (or gzip) with an ETag; If-None-Match -> 304 with no body; no Accept-Encoding -> plain;
//      the page reaches brotli quality 11 in the background; a big API reply is compressed; sw.js revalidates the page (no-cache).
(async function main() {
const path = require('path'), vm = require('vm'), fs = require('fs'), cp = require('child_process'), os = require('os'), net = require('net'), http = require('http'), zlib = require('zlib');
const ROOT = path.resolve(__dirname, '..');
const HTML = path.join(ROOT, 'emberweave-heroes.html');
const Q95 = require('./helpers/q95-1158.js');   // v1158: a q95 tier file is checked as the v1157 lossless file it was (tests/test_q95_1158.js checks the q95 file)
const BASE_SHA = process.env.EW_BASE || 'c5adff17';   // v1154: live v1153, the release this one is built on (was v1140 25d88920 when the condense was first cut)
const PY = process.env.PYTHON || 'python';
let pass = 0, fail = 0;
const ck = (name, ok, detail) => { if (ok) { pass++; console.log('  ok  ' + name); } else { fail++; console.log('  FAIL ' + name + (detail ? ' - ' + detail : '')); } };
const webpInfo = f => { const b = Buffer.alloc(30); const fd = fs.openSync(f, 'r'); fs.readSync(fd, b, 0, 30, 0); fs.closeSync(fd);
  const tag = b.toString('ascii', 12, 16);
  if (tag === 'VP8L') { const v = b.readUInt32LE(21); return { kind: 'lossless', w: 1 + (v & 0x3fff), h: 1 + ((v >> 14) & 0x3fff) }; }
  if (tag === 'VP8X') { const all = fs.readFileSync(f); let i = 12, kind = '?'; while (i + 8 <= all.length) { const t = all.toString('ascii', i, i + 4), n = all.readUInt32LE(i + 4); if (t === 'VP8L') { kind = 'lossless'; break; } if (t === 'VP8 ') { kind = 'lossy'; break; } i += 8 + n + (n & 1); }
    return { kind, w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) }; }
  if (tag === 'VP8 ') return { kind: 'lossy', w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  return null; };
const load = f => { const h = require(path.join(ROOT, 'server/sim-host.js')).load(f); return src => vm.runInContext(src, h.ctx); };
const DUMP = `JSON.stringify({c:Object.fromEntries(Object.keys(BATTLE_ANIM).map(k=>[k,BATTLE_ANIM[k]])), f:FX2_DEF})`;
try {
  const run = load(HTML);
  require('./helpers/vael-fx-1171.js').undoVaelFx1171(run);   // v1171: Vael's three FX entries go back to v1164's - the tier table still lists his two replaced plates (unreferenced, harmless; tests/test_vael_fx_1171.js)
  const T = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/anim/tiers_1141.json'), 'utf8')).sheets;
  const CL = JSON.parse(run(`JSON.stringify([].concat(...Object.keys(BATTLE_ANIM).map(k=>Object.keys(BATTLE_ANIM[k]).filter(s=>s[0]!=='_'&&BATTLE_ANIM[k][s]&&BATTLE_ANIM[k][s].u).map(s=>Object.assign({k,s},BATTLE_ANIM[k][s])))).concat(Object.keys(FX2_DEF).map(k=>Object.assign({k,s:'fx',fx:1},FX2_DEF[k]))))`));
  const byPath = {}; CL.forEach(c => { const p = String(c.u).split('?')[0]; (byPath[p] = byPath[p] || []).push(c); });
  const frozen = new Set(JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/sheet_size_baseline_1140.json'), 'utf8')).files);
  const K = list => JSON.parse(run(`(()=>{ window.__texPhone=1; try{ return JSON.stringify(${JSON.stringify(list)}.map(c=>texSheetK(c.fw,c.fh,c.cols||c.n,c.rows||1,(c.figH&&c.fh)?c.figH/c.fh:0))); } finally{ window.__texPhone=null; } })()`));

  // ------------------------------------------------------------------ 1. TABLE + FILES
  const paths = Object.keys(T), probs = [];
  let nP = 0, nH = 0, bytesOrig = 0, bytesP = 0, memV = 0, memP = 0, figGain = [];
  for (const p of paths) {
    const cs = byPath[p]; if (!cs) { probs.push(p + ' is in no clip table'); continue; }
    const c = cs[0], cols = c.cols || c.n, rows = c.rows || 1, orig = Q95.file(ROOT, p), ob = fs.statSync(orig).size;
    if (cs.some(x => x.s === 'idle' || x.s === 'walk')) probs.push(p + ' is an idle/walk sheet');
    for (const t of Object.keys(T[p])) {
      const [u, W, H, gc, gr, tc] = T[p][t], f = Q95.file(ROOT, u);
      if (!/\?v=1141$/.test(u.replace(/\?v=1158$/, Q95.BY.has(u.split('?')[0]) ? '?v=1141' : '?v=bad')) || !fs.existsSync(f)) { probs.push(u + ' missing / not ?v=1141 (v1158: ?v=1158 exactly when q95)'); continue; }
      const i = webpInfo(f), by = fs.statSync(f).size, n = Math.min(c.n, cols * rows);
      if (!i || i.kind !== 'lossless') probs.push(u + ' is not lossless WebP');
      if (!i || i.w !== W || i.h !== H) probs.push(u + ' decodes ' + (i && i.w) + 'x' + (i && i.h) + ' not ' + W + 'x' + H);
      if (gc * gr < n || W % gc || H % gr) probs.push(u + ' grid ' + gc + 'x' + gr + ' cannot hold ' + n + ' cells of ' + W + 'x' + H);
      if (tc && !(tc.length === 4 && tc.every(x => x >= 0 && x <= 1) && tc[0] + tc[2] <= 1 + 1e-6 && tc[1] + tc[3] <= 1 + 1e-6)) probs.push(u + ' bad tc');
      if (t === 'p') {
        nP++; bytesOrig += ob; bytesP += by;
        const kv = K([c])[0], vW = Math.max(1, Math.round(c.fw * kv)) * cols, vH = Math.max(1, Math.round(c.fh * kv)) * rows;
        if (Math.max(W, H) > Math.max(2048, vW, vH) || by > 4e6) probs.push(u + ' over the v1140 file ratchet (2048 px, or what v1140 itself uploads to keep a 160 px figure; 4 MB)');
        if (by > ob) probs.push(u + ' is a bigger download than its original');
        if (!c.fx) {   // memory <= v1140's upload; figure px >= v1140's
          memV += vW * vH; memP += W * H;
          if (W * H > vW * vH * 1.002) probs.push(u + ' holds more texture than v1140 uploads (' + W * H + ' > ' + vW * vH + ')');
          const cellH = H / gr / (tc ? tc[3] : 1), kp = cellH / c.fh; figGain.push(kp / kv);
          if (kp < kv * 0.995) probs.push(u + ' shows fewer px than v1140 (' + kp.toFixed(3) + ' < ' + kv.toFixed(3) + ')');
        } else if (gc !== cols || gr !== rows || tc) probs.push(u + ' a spell sheet must keep its grid, untrimmed');
      } else {
        nH++;
        const oi = webpInfo(orig);
        if (!(oi && W <= oi.w && H <= oi.h && by < ob)) probs.push(u + ' is not a smaller crop of its original');
        if (oi && oi.kind !== 'lossless') probs.push(u + ' trims a LOSSY original (would need a re-encode)');
        if ((Math.max(W, H) > 2048 || by > 4e6) && !frozen.has(p) && !T[p].p) probs.push(u + ' oversize, and its original is neither a frozen v1140 file nor phone-tiered (desktop only)');
        if (gc !== cols || gr !== rows) probs.push(u + ' a high-tier crop keeps the original grid');
      }
    }
  }
  figGain.sort((a, b) => a - b);
  console.log('  info ' + paths.length + ' sheets tiered: ' + nP + ' phone files (' + (bytesOrig / 1e6).toFixed(1) + ' MB of originals -> ' + (bytesP / 1e6).toFixed(1) + ' MB), ' + nH +
    ' trimmed high files; phone texture memory vs v1140 for those clips ' + (memP / 1e6 * 4).toFixed(0) + ' / ' + (memV / 1e6 * 4).toFixed(0) + ' MB; figure px vs v1140: median x' +
    (figGain[figGain.length >> 1] || 1).toFixed(2) + ', min x' + (figGain[0] || 1).toFixed(2));
  ck('every tier file is in the table rules: lossless, exact size, grid, ?v=1141, phone <= 2048 px (or the v1140 floor size) / 4 MB / original bytes / v1140 memory, >= v1140 figure px; high = smaller crop of a lossless oversize original (frozen, or desktop-only behind a phone file); no idle/walk (' + paths.length + ' sheets)',
    probs.length === 0 && nP > 50 && nH > 5, probs.slice(0, 6).join('; '));

  // ------------------------------------------------------------------ 2. TRIM CORRECTNESS
  const V = JSON.parse(cp.execFileSync(PY, ['-I', path.join(ROOT, 'tools/condense_verify.py'), ROOT, '--regen', '8', '--q95', path.join(__dirname, 'fixtures/q95_1158.json')], { maxBuffer: 16 << 20 }).toString());
  ck('every cell of every tier file is pixel-identical to the untrimmed cell at its tier (' + V.checked + ' files)', V.nbad === 0 && V.checked === nP + nH, JSON.stringify(V.bad.slice(0, 3)));
  ck('trimmed HIGH files match their original file cell for cell (' + V.high_src_checked + ' sheets)', V.high_src_checked === nH && V.high_src_bad.length === 0, V.high_src_bad.join(','));
  ck('8 phone sheets re-resampled from the original reproduce the manifest exactly', V.regen.length === 8 && V.regen_bad.length === 0, V.regen_bad.join(','));
  ck('CONTROL: one nudged visible pixel fails the pixel check', /differs/.test(String(V.control)), V.control);

  // ------------------------------------------------------------------ 3. CLIP DATA UNCHANGED
  const baseHtml = cp.execSync('git show ' + BASE_SHA + ':emberweave-heroes.html', { cwd: ROOT, maxBuffer: 64 << 20 }).toString();
  const BASEF = path.join(ROOT, '.test-condense-base.html'); fs.writeFileSync(BASEF, baseHtml); process.on('exit', () => { try { fs.unlinkSync(BASEF); } catch (e) {} });
  /* v1157: the v1155 animation slim (tests/fixtures/anim_slim_1155.json, checked entry by entry in tests/test_anim_slim_1155.js) is the only
     clip-data change since BASE - with its entries put back, every table must be BASE byte for byte; the condense itself changes none */
  const runU = load(Q95.page(HTML)); require('./helpers/anim-slim-1155.js').undoSlim1155(runU);
  const a = runU(DUMP), b = load(BASEF)(DUMP);
  ck('every BATTLE_ANIM / FX2_DEF entry (cells, fps, anchors, ax, contact/relFrac) is identical to BASE ' + BASE_SHA + ' once the v1155 slim entries are put back', a === b && a.length > 100000, a.length + ' vs ' + b.length);

  // ------------------------------------------------------------------ 4-7. BROWSER + SERVER
  let chromium = null; try { chromium = require('playwright').chromium; } catch (e) {}
  const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.once('error', rej); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); });
  const port = await freePort(), base = 'http://127.0.0.1:' + port, tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ew-cond-'));
  const srv = cp.spawn(process.execPath, ['server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(port), DB_FILE: path.join(tmp, 'db.json') }, stdio: 'ignore', windowsHide: true });
  let browser;
  const get = (p, headers) => new Promise((res, rej) => { http.get(base + p, { headers: headers || {} }, r => { const ch = []; r.on('data', c => ch.push(c)); r.on('end', () => res({ s: r.statusCode, h: r.headers, b: Buffer.concat(ch) })); }).on('error', rej); });
  try {
    for (let i = 0; i < 100; i++) { try { if ((await fetch(base + '/health')).ok) break; } catch (_) {} await new Promise(r => setTimeout(r, 150)); }
    // 7. COMPRESSION
    const raw = fs.readFileSync(HTML);
    const r1 = await get('/play', { 'accept-encoding': 'gzip, deflate, br' });
    const ok1 = r1.s === 200 && r1.h['content-encoding'] === 'br' && /^"[\w+/=]{20,}"$/.test(r1.h.etag || '') && zlib.brotliDecompressSync(r1.b).equals(raw);
    ck('/play goes out brotli with a content ETag and decodes to the file byte for byte (' + raw.length + ' -> ' + r1.b.length + ' bytes)', ok1, r1.s + ' ' + r1.h['content-encoding'] + ' ' + r1.h.etag);
    const r304 = await get('/play', { 'accept-encoding': 'br', 'if-none-match': r1.h.etag });
    ck('If-None-Match with that ETag -> 304 Not Modified and no body (a launch with nothing deployed downloads nothing)', r304.s === 304 && r304.b.length === 0, r304.s + ' ' + r304.b.length);
    const rg = await get('/play', { 'accept-encoding': 'gzip' }), rp = await get('/play', {});
    ck('gzip for a gzip-only client; identity (no Content-Encoding, the exact bytes) with no Accept-Encoding', rg.h['content-encoding'] === 'gzip' && zlib.gunzipSync(rg.b).equals(raw) && !rp.h['content-encoding'] && rp.b.equals(raw));
    let best = r1.b.length; for (let i = 0; i < 60 && best >= r1.b.length; i++) { await new Promise(r => setTimeout(r, 500)); best = (await get('/play', { 'accept-encoding': 'br' })).b.length; }
    ck('the page reaches brotli quality 11 in the background (' + r1.b.length + ' -> ' + best + ' bytes, still the same ETag)', best < r1.b.length * 0.95);
    const js = await get('/hero-profiles.js', { 'accept-encoding': 'br' }), js2 = await get('/assets/anim/tiers_1141.json?v=1158', { 'accept-encoding': 'br' }), sw = await get('/sw.js', { 'accept-encoding': 'gzip' });
    ck('JS and JSON go out compressed with an ETag (hero-profiles.js, tiers_1141.json, sw.js)', js.h['content-encoding'] === 'br' && js2.h['content-encoding'] === 'br' && sw.h['content-encoding'] === 'gzip' && !!js.h.etag && !!js2.h.etag);
    /* v1154: since v1144 (sign-in first) /api/guest refuses a NEW guest (403), so the API check signs up a real account */
    const guest = await (await fetch(base + '/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'cnd' + Date.now().toString(36), pass: 'password1' }) })).json();
    if (!guest || !guest.token) throw new Error('register gave no token: ' + JSON.stringify(guest).slice(0, 200));
    const gc = await get('/api/glyphs/catalog', { 'accept-encoding': 'br', 'x-token': guest.token }), gp = await get('/api/glyphs/catalog', { 'x-token': guest.token });
    ck('a big API reply (glyph catalog) is compressed and decodes to the same JSON; without Accept-Encoding it is plain', gc.h['content-encoding'] === 'br' && zlib.brotliDecompressSync(gc.b).toString() === gp.b.toString() && !gp.h['content-encoding'] && gp.b.length > 4096,
      gc.h['content-encoding'] + ' ' + gc.b.length + '/' + gp.b.length);
    ck("sw.js revalidates the page (cache:'no-cache', so the 304 reaches the app) instead of re-downloading it (cache:'reload')", /isDoc \? \{ cache: 'no-cache' \}/.test(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8')));

    if (!chromium) { ck('playwright is available for the browser half', false); }
    else {
      try { browser = await chromium.launch({ args: ['--mute-audio', '--js-flags=--expose-gc'] }); } catch (e) { browser = await chromium.launch({ channel: 'chrome', args: ['--mute-audio', '--js-flags=--expose-gc'] }); }
      const PHONE = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
        userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36' };
      const DESK = { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 };
      const open = async (opt, init) => { const ctx = await browser.newContext(opt); if (init) await ctx.addInitScript(init.fn, init.arg);
        await ctx.addInitScript(() => { window.__fetched = []; const of = window.fetch; window.fetch = function (u) { try { window.__fetched.push(String(u && u.url || u)); } catch (e) {} return of.apply(this, arguments); }; });
        const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e.message)));
        await pg.goto(base + '/play', { waitUntil: 'domcontentloaded' }); await pg.waitForTimeout(2000); return { ctx, pg, errs }; };
      // 4. TIER PICK
      const pick = async (opt, init) => { const o = await open(opt, init); const t = await o.pg.evaluate(() => ART_TIER); await o.ctx.close(); return t; };
      const picks = { phone: await pick(PHONE), desktop: await pick(DESK), tablet: await pick({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }),
        lowmem: await pick(DESK, { fn: () => { Object.defineProperty(Navigator.prototype, 'deviceMemory', { get: () => 2, configurable: true }); } }),
        override: await pick(PHONE, { fn: () => { try { localStorage.setItem('ew_art_tier', 'high'); } catch (e) {} } }) };
      ck('tier pick: 844x390 phone -> phone, 1920x1080 -> high, 1180x820 tablet -> high, deviceMemory 2 -> phone, ew_art_tier=high on a phone -> high', picks.phone === 'phone' && picks.desktop === 'high' && picks.tablet === 'high' && picks.lowmem === 'phone' && picks.override === 'high', JSON.stringify(picks));
      const fightKeys = { a: ['grosk', 'gruel', 'fritz'], f: ['rhukk', 'umbris', 'oakmir'] };
      const enter = async (pg) => { await pg.evaluate(() => { const p = document.querySelector('.splashPlay'); if (p) p.click(); }); await pg.waitForTimeout(900);
        await pg.evaluate(async () => { const reg = await api('/api/register', 'POST', { name: 'cnd' + Date.now().toString(36), pass: 'password1' }); ACC.token = reg.token; ACC.id = reg.profile.id; G.tutStarted = true; G.tutDone = true; document.body.classList.remove('gated'); show('home'); });
        await pg.waitForTimeout(500); };
      const fight = async (pg, seed, drive) => {
        if (drive) {   // stop the real clock BEFORE the fight exists (and let the one frame already queued run out), then drive loop() by hand
          await pg.evaluate(() => { window.requestAnimationFrame = () => 0; }); await pg.waitForTimeout(250);
          await pg.evaluate(() => { window.__T = (typeof last === 'number' && isFinite(last)) ? last : performance.now(); }); }
        await pg.evaluate(({ k, seed }) => {
          window.__fetched.length = 0; CUR = { mode: 'replay', seed, oppName: 'T' }; startVersus(k.f.map(x => ({ key: x, level: 60, rank: 3 })), true, k.a); }, { k: fightKeys, seed });
        for (let i = 0; i < 240; i++) { if (await pg.evaluate(() => state === 'battle' && units.length > 0)) break; await pg.waitForTimeout(250); } await pg.waitForTimeout(600); };
      const sheetState = pg => pg.evaluate(keys => { const o = {}; keys.forEach(k => { const s = BATTLE_ANIM[k]; for (const st in s) { const c = s[st]; if (st[0] !== '_' && c && c.tex && c.tex.image) o[k + '.' + st] = { u: c.u, fu: c._fu || c.u, w: c.tex.image.width, h: c.tex.image.height, lay: c._lay || null }; } }); return o; }, fightKeys.a.concat(fightKeys.f));
      const P = await open(PHONE); await enter(P.pg); await fight(P.pg, 7, false);
      const ps = await sheetState(P.pg), fetchedP = await P.pg.evaluate(() => window.__fetched.filter(u => /\/assets\/anim\//.test(u)));
      const D = await open(DESK); await enter(D.pg); await fight(D.pg, 7, false);
      const ds = await sheetState(D.pg);
      const tierOf = (st, t) => { const e = T[String(st.u).split('?')[0]]; return e && e[t]; };
      const pBad = Object.entries(ps).filter(([, v]) => { const e = tierOf(v, 'p'); return e ? !(v.fu === e[0] && v.w === e[1] && v.h === e[2]) : v.fu !== v.u; });
      const dBad = Object.entries(ds).filter(([, v]) => { const e = tierOf(v, 'h'); return e ? !(v.fu === e[0] && v.w === e[1] && v.h === e[2]) : !(v.fu === v.u); });
      const pTier = Object.values(ps).filter(v => tierOf(v, 'p')).length, dTier = Object.values(ds).filter(v => tierOf(v, 'h')).length;
      ck('a phone fight loads the PHONE files, each decoded at exactly its W x H (no second resize); untiered sheets load their originals (' + pTier + ' of ' + Object.keys(ps).length + ' sheets tiered)', pBad.length === 0 && pTier >= 20, pBad.slice(0, 3).map(x => x[0] + ' ' + JSON.stringify(x[1])).join('; '));
      ck('a desktop fight loads the trimmed HIGH files where they exist, the originals otherwise (' + dTier + ' trimmed)', dBad.length === 0 && dTier >= 5, dBad.slice(0, 3).map(x => x[0] + ' ' + JSON.stringify(x[1])).join('; '));
      const fighters = new Set(fightKeys.a.concat(fightKeys.f).map(k => k.replace(/\s/g, '')));
      const stray = fetchedP.filter(u => { const m = /\/assets\/anim\/([^/]+)\//.exec(u); return m && m[1] !== 'fx' && !fighters.has(m[1]); });
      ck('only the six fighters\' battle sheets are fetched for the fight (' + fetchedP.length + ' anim requests, none for other heroes)', fetchedP.length > 20 && stray.length === 0, stray.slice(0, 4).join(','));
      // 5. PLACEMENT: quad expanded by tc == the logical cell drawn untrimmed
      const place = await P.pg.evaluate(() => { const out = []; for (const u of units) { const A = u.anim && u.anim[u._animSt]; const L = A && A._lay; if (!L || !L.tc || !u._sprRef) continue;
          const spr = u._sprRef, tc = L.tc, sx = spr.scale.x, sy = spr.scale.y, cx = spr.center.x, cy = spr.center.y;
          // trimmed quad in sprite-local units (anchor at 0): x from -cx*sx to (1-cx)*sx; the logical cell is the quad grown by tc
          const mir = u._fxMirror; const W = sx / tc[2], Hh = sy / tc[3];
          const left = -cx * sx - (mir ? (1 - tc[0] - tc[2]) : tc[0]) * W, bottom = -cy * sy - (1 - tc[1] - tc[3]) * Hh;
          const qh = A.figH ? u.sprH * (A.fh / A.figH) * ((A.fs && A.fs.length) ? (A.fs[Math.min(u._fxFr || 0, A.fs.length - 1)] || 1) : 1) : u.sprH * (A.sc || 1);
          let cxp = (A.cx != null ? A.cx : A.fw * 0.5); if (A.ax && A.ax.length) cxp += A.ax[Math.min(u._fxFr || 0, A.ax.length - 1)] || 0;
          /* v1154: a dying unit withers (scale.y = sprH*(1-0.45k)), so its quad height is that, not qh - checked the same way (dead units joined the sample once fights changed) */
          const hq = u.alive ? qh : Math.max(.01, u.sprH * (1 - Math.min(1, (u.deathT || 0) / .9) * 0.45));
          const wantLeft = -(mir ? 1 - cxp / A.fw : cxp / A.fw) * qh * (A.fw / A.fh), wantBottom = A.figH ? -(1 - A.feet / A.fh) * hq : 0;
          out.push({ k: u.key, st: u._animSt, mir, dl: left - wantLeft, db: bottom - wantBottom, dw: W - qh * (A.fw / A.fh), dh: Hh - hq, dead: !u.alive }); }
        return out; });
      /* v1154: the death wither on a trimmed sheet, forced (a dying unit is not always in the sample): half-way through the 0.9 s fade the quad
         grown by tc must be sprH*(1-0.45*0.5) tall, exactly the untrimmed quad (CONTROL: v1153's wither line, which ignores tc, fails it) */
      const wither = await P.pg.evaluate(() => { const u = units.find(x => { const A = x.anim && x.anim[x._animSt]; return x.alive && A && A._lay && A._lay.tc && A._lay.tc[3] < 0.999 && x._sprRef; }); if (!u) return null;
        const A = u.anim[u._animSt], tc = A._lay.tc; const _dc = typeof DEATH_CLIPS !== 'undefined' ? DEATH_CLIPS.on : null; if (_dc !== null) DEATH_CLIPS.on = false; u._die = null; u.alive = false; u.deathT = 0.45; syncMesh(u, 0); if (_dc !== null) DEATH_CLIPS.on = _dc; const spr = u._sprRef;   /* v1187: the FADE is checked here - a hero's death clip (v1182) would draw instead */
        return { k: u.key, st: u._animSt, tc3: tc[3], dh: spr.scale.y / tc[3] - Math.max(.01, u.sprH * (1 - 0.5 * 0.45)) }; });
      ck('a dying unit on a trimmed sheet withers exactly like the untrimmed quad (' + (wither && (wither.k + ' ' + wither.st + ', tc h ' + wither.tc3.toFixed(3))) + ')', !!wither && Math.abs(wither.dh) < 1e-6, JSON.stringify(wither));
      ck('a trimmed sprite\'s quad, grown by tc, is exactly the logical cell the untrimmed sheet draws - same anchor, both facings (' + place.length + ' sprites)', place.length >= 2 && place.every(p => Math.abs(p.dl) < 1e-6 && Math.abs(p.db) < 1e-6 && Math.abs(p.dw) < 1e-6 && Math.abs(p.dh) < 1e-6), JSON.stringify(place.slice(0, 2)));
      // 4b. release on the hub
      const held = pg => pg.evaluate(() => { let n = 0; for (const k in BATTLE_ANIM) { const s = BATTLE_ANIM[k]; for (const st in s) if (st[0] !== '_' && s[st] && s[st].tex) n++; } return n; });
      const h0 = await held(P.pg); await P.pg.evaluate(() => { ended = true; show('home'); }); await P.pg.waitForTimeout(1500); const h1 = await held(P.pg);
      ck('going home frees every battle sheet, tier files included (' + h0 + ' -> ' + h1 + ')', h0 > 20 && h1 === 0);
      ck('no page error on either tier', P.errs.length === 0 && D.errs.length === 0, P.errs.concat(D.errs).slice(0, 3).join(' | '));
      await P.ctx.close(); await D.ctx.close();
      // 6. TICK-IDENTICAL across tiers
      const trace = async (opt, tier, seed) => { const o = await open(opt, { fn: t => { try { localStorage.setItem('ew_art_tier', t); } catch (e) {} }, arg: tier }); await enter(o.pg); await fight(o.pg, seed || 4242, true);
        const tr = await o.pg.evaluate(() => { const out = []; last = window.__T; try { _bacc = 0; } catch (e) {}
          /* recorded per SIM TICK (updateBattle wrapped), not per frame: how many ticks a render frame runs is a wall-clock matter, what each tick does is the fight */
          const ub = updateBattle; updateBattle = function (dt) { const r = ub.apply(this, arguments); out.push(battleTime.toFixed(4) + '|' + units.map(u => [u.key, Math.round(u.hp * 100), Math.round(u.x * 10), Math.round(u.y * 10), u.alive ? 1 : 0, Math.round((u.energy || 0) * 10)].join(':')).join(',')); return r; };
          for (let f = 0; f < 600; f++) { window.__T += 1000 / 60; document.body.classList.remove('gated'); try { loop(window.__T); } catch (e) {} } updateBattle = ub; return out; });
        const t = await o.pg.evaluate(() => ART_TIER); await o.ctx.close(); return { t, tr }; };
      const tp = await trace(PHONE, 'phone'), th = await trace(PHONE, 'high');
      const nT = Math.min(tp.tr.length, th.tr.length), firstDiff = tp.tr.slice(0, nT).findIndex((x, i) => x !== th.tr[i]);
      const tc = await trace(PHONE, 'high', 4243), ctlDiff = tc.tr.slice(0, Math.min(tc.tr.length, th.tr.length)).findIndex((x, i) => x !== th.tr[i]);
      ck('CONTROL: the trace does see a different fight (seed 4243 diverges from 4242 at tick ' + ctlDiff + ')', ctlDiff > 0);
      ck('the same seeded fight (600 frames, ' + nT + ' sim ticks) on the phone tier and the high tier: identical hp/x/y/alive/energy after every tick', tp.t === 'phone' && th.t === 'high' && firstDiff === -1 && nT > 250, 'first diff at frame ' + firstDiff + ': ' + (tp.tr[firstDiff] || '').slice(0, 160) + ' vs ' + (th.tr[firstDiff] || '').slice(0, 160));
    }
  } finally { try { if (browser) await browser.close(); } catch (e) {} try { srv.kill(); } catch (e) {} }
} catch (e) { console.log('  FAIL test crashed - ' + (e && e.stack || e)); fail++; }
console.log((fail ? 'FAIL ' : 'PASS ') + (pass + fail) + ' checks' + (fail ? ', ' + fail + ' failed' : ''));
process.exit(fail ? 1 : 0);
})();
