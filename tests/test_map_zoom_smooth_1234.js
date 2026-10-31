'use strict';
// v1234 MAP ZOOM SMOOTHNESS (Claude 31 Oct 2026, Phil's approved proposal - F1 + C2 only; C3/C4 later).
// F1: the NEXT finer and NEXT coarser level are preloaded for the VISIBLE area only; the preload count is
//     capped (phones get WM_LOD_CAP_PHONE via texPhone()) and the ring on a NEIGHBOUR level is at most 1 tile.
// C2: no 3 s tear-off while the new level is still loading - the OLD level stays on screen until the new
//     level's tiles complete, then a 0.25 s fade.
// The branch's REAL names (ew-mapzoom/emberweave-heroes.html): WM_LOD_CAP=120, WM_LOD_CAP_PHONE=48,
// wmPreloadNeigh() loading into WM_PRELOAD_CACHE=new Map() (off the DOM), lodCap(rl[lodIdx-1]) and
// lodCap(rl[lodIdx+1]) for both adjacent levels, layer._realmGen=++_lodGen, the sweep's hold guard
// `if(layer._realmGen!==_lodGen) return;`, and the old level removed only once every wanted tile is complete.
// CONTROL: the same checks against 7c6f8f8a (live at 31 Oct 2026) MUST fail - the base has none of those
// constants and tears the old level off with setTimeout(...,3000) inside applyMapLOD.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const ROOT = path.join(__dirname, '..', '..');
// this worktree has no node_modules (Claude 11:34): resolve playwright the way the tree's own tests do,
// then fall back to the suite worktree's copy, then to a NODE_PATH-resolved one.
let chromium = null;
for (const p of [path.join(ROOT, 'node_modules', 'playwright'),
                 'C:\\Users\\Home\\Downloads\\ew-realm-suite\\node_modules\\playwright',
                 'playwright']) {
  try { const pw = require(p); chromium = pw.chromium; if (chromium) break; } catch (e) {}
}
if (!chromium) throw Error('playwright not resolvable from ' + ROOT + ' or the suite worktree');
const R = require('./helpers/split-rig.cjs');
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const CONTROL_SHA = '7c6f8f8a';

// ---------- static: the v1234 contract in the client source ----------
function staticChecks(dir) {
  const html = fs.readFileSync(path.join(dir, 'emberweave-heroes.html'), 'utf8');
  const capM = html.match(/WM_LOD_CAP\s*=\s*(\d+)/);
  const capPhM = html.match(/WM_LOD_CAP_PHONE\s*=\s*(\d+)/);
  // the swap block only: the base's tear-off lives here (setTimeout(lodArm,3000))
  const i = html.indexOf('function applyMapLOD');
  const seg = i < 0 ? '' : html.slice(i, i + 4200);
  return {
    cap: capM ? Number(capM[1]) : -1,
    capPhone: capPhM ? Number(capPhM[1]) : -1,
    phoneCap: /texPhone\s*\(\s*\)[^;]{0,80}WM_LOD_CAP_PHONE/.test(html),
    preloadFn: /function\s+wmPreloadNeigh\s*\(/.test(html),
    cacheOffDom: /WM_PRELOAD_CACHE\s*=\s*new\s+Map\s*\(/.test(html),
    bothDirs: /lodCap\(\s*rl\s*\[\s*lodIdx\s*-\s*1\s*\]\s*\)/.test(html) && /lodCap\(\s*rl\s*\[\s*lodIdx\s*\+\s*1\s*\]\s*\)/.test(html),
    ringOne: /Math\s*\.\s*min\s*\(\s*ring\s*,/.test(html),
    fade250: /opacity\s+\.25s/.test(html),
    genGuard: /layer\._realmGen\s*=\s*\+\+_\lodGen/.test(html),
    holdOld: /if\s*\(\s*layer\._realmGen\s*!==\s*gen\s*\)\s*return/.test(html),   // v1235 correction (Ember 31 Oct 14:25): the guard compares against the CAPTURED gen, not live _lodGen. `layer._realmGen=++_lodGen` assigns BOTH in one statement, so `layer._realmGen!==_lodGen` is ALWAYS false - that literal can never hold a level. The captured form is the one that actually keeps an older zoom's callback from tearing the new level off.
    tearOff: /setTimeout\s*\(/.test(seg),
  };
}

// ---------- runtime: the real client, phone viewport ----------
async function browserChecks(S, B) {
  const v = B.players[0];
  const browser = await chromium.launch({ headless: true, executablePath: fs.existsSync(CHROME) ? CHROME : undefined });
  const errors = [], tileReqs = [];
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });   // phone viewport: the phone cap must apply
    page.on('pageerror', e => { errors.push(e.message); console.log('PAGEERROR ' + String(e.message).slice(0, 300)); });
    page.on('request', r => { const u = r.url(); if (/\.webp/.test(u) && /z\d+/.test(u)) tileReqs.push(u); });
    await page.goto(S.base + '/play', { waitUntil: 'domcontentloaded' });
    const boot = await page.evaluate(() => { try { return 'ACC=' + typeof ACC + ' G=' + typeof G; } catch (e) { return 'REF:' + e.message; } });
    console.log('BOOT ' + boot + ' pageerrors=' + errors.length);
    await page.evaluate(t => { ACC.token = t; G.playerXP = 900000; }, v.token);
    if (await page.locator('#tutSkip').isVisible()) await page.locator('#tutSkip').click();
    await page.locator('#splashPlay').click();
    await page.waitForFunction(() => document.getElementById('rotateGate')?.style.display === 'none', null, { timeout: 20000 });
    await page.evaluate(() => { show('world'); });
    await page.waitForFunction(() => document.getElementById('wzoneInner'), null, { timeout: 20000 });
    const state = () => page.evaluate(() => {
      const inner = document.getElementById('wzoneInner'); if (!inner) return { srcs: [], zoom: worldZoom };
      const layer = inner.querySelector('#realmTiles');
      const im0 = layer ? layer.querySelector('img') : null;
      const mz = im0 ? /z(-?\d+)\//.exec(im0.getAttribute('src') || '') : null;
      return { zoom: worldZoom,
        realmZ: mz ? Number(mz[1]) : -1,
        srcs: layer ? [...layer.querySelectorAll('img')].map(im => im.getAttribute('src') || '') : [] };
    });
    await page.evaluate(() => {   // the zoom drive must run IN THE PAGE: these are client functions, not Node ones
      const c = (typeof myCastlePos === 'function') ? myCastlePos() : null;
      if (c && typeof mapZoomCloseAt === 'function') mapZoomCloseAt(c.x, c.y); else worldZoomTo(999);
    });
    await page.waitForTimeout(2500);
    const close = await state(); const reqAtClose = tileReqs.length;
    // zoom OUT to the NEXT coarser realm level - NOT the coarsest. The client deliberately paints
    // NO realm tiles at the coarsest level (applyMapLOD: `const base=RL===rl[rl.length-1? ?[]:...`),
    // the picture layer covers the world there, so a swap to it can never show new realm srcs.
    const swap = await page.evaluate(async () => {
      const L = REALM_MAP.META.levels;
      const cur = realmLevelFor(worldZoom);
      let i = L.indexOf(cur); if (i < 0) i = 0;
      const ti = Math.min(i + 1, L.length - 2);
      const fromZ = cur.z;
      if (ti < 0) return { fromZ, toZ: -1, blank: 0, samples: 0, firstSrcs: [] };
      const hi = L[ti].cellPx;
      const lo = L[ti + 1] ? L[ti + 1].cellPx : 0;
      const need = (hi + lo) / 2;   // mid of that level's pixel band, so the level pick is stable
      const dpr = Math.max(1, globalThis.devicePixelRatio || 1);
      const nz = need * REALM_MAP.META.cols / (WORLD_W * dpr);
      worldZoomTo(nz);
      const layer = document.getElementById('wzoneInner').querySelector('#realmTiles');
      let blank = 0, samples = 0; const firstSrcs = [];
      for (let t = 0; t < 2400; t += 100) {
        const kids = [...layer.children];
        if (samples === 0) for (const im of kids) firstSrcs.push(im.getAttribute('src') || '');
        if (!kids.some(im => im.complete && im.naturalWidth)) blank++;
        samples++;
        await new Promise(r => setTimeout(r, 100));
      }
      return { fromZ, toZ: realmLevelFor(worldZoom).z, blank, samples, firstSrcs };
    });
    const mid = { zoom: swap.toZ, realmZ: swap.toZ, srcs: swap.firstSrcs };
    const reqMid = tileReqs.length - reqAtClose;
    const after = await state(); const reqAfter = tileReqs.length - reqAtClose - reqMid;
    // RAPID A->B (Ember 31 Oct 14:20, from Claude 13:50): fire zoom A, then zoom B BEFORE A's onload
    // sweep can land. A's cleanup must never remove B's tiles - the generation guard is what keeps
    // them. The base (7c6f8f8a) has no guard at all, so these checks must fail there.
    const rapid = await page.evaluate(async () => {
      const layer = document.getElementById('wzoneInner').querySelector('#realmTiles');
      const srcs = () => [...layer.querySelectorAll('img')].map(im => im.getAttribute('src') || '');
      const L = REALM_MAP.META.levels;
      const dpr = Math.max(1, globalThis.devicePixelRatio || 1);
      const bandMid = (k) => (L[k].cellPx + (k + 1 < L.length ? L[k + 1].cellPx : L[k].cellPx * 0.5)) / 2;
      const zoomTo = (k) => worldZoomTo(bandMid(k) * REALM_MAP.META.cols / (WORLD_W * dpr));
      let i = L.indexOf(realmLevelFor(worldZoom)); if (i < 0) i = 0;
      const aIdx = i > 0 ? i - 1 : Math.min(1, L.length - 2);   // A = the neighbour level we are about to leave
      zoomTo(aIdx);                                             // A: paints A's tiles, arms A's sweep
      const aSrcs = srcs();
      zoomTo(i);                                                // B: fired while A's tiles are still loading
      // B's OWN tiles only, by tileKey (layer.dataset.tiles is B's paint list). The layer still holds
      // A's leftovers too, and B's own sweep correctly removes those once B's tiles arrive - so counting
      // every img in the layer would measure A's tiles as well, not B's.
      const bKeys = new Set((layer.dataset.tiles || '').split(',').filter(Boolean));
      const bSrcs = [...layer.querySelectorAll('img')].filter(im => bKeys.has(im.dataset.tileKey))
                    .map(im => im.getAttribute('src') || '');
      for (let t = 0; t < 2400; t += 100) await new Promise(r => setTimeout(r, 100));
      const end = srcs();
      return { aCount: aSrcs.length, bCount: bSrcs.length,
               bKept: bSrcs.filter(s => end.indexOf(s) >= 0).length, endCount: end.length };
    });
    return { errors, close, mid, after, reqMid, reqAfter, swap, rapid, phone: await page.evaluate(() => texPhone()) };
  } finally { await browser.close(); }
}

function judge(st, br, ok) {
  ok(st.cap > 0, 'the desktop preload cap exists and is positive (WM_LOD_CAP = ' + st.cap + ')');
  ok(st.capPhone > 0 && st.capPhone <= st.cap, 'the phone preload cap exists and is no looser than the desktop one (WM_LOD_CAP_PHONE = ' + st.capPhone + ' <= ' + st.cap + ')');
  ok(st.phoneCap, 'the phone cap is applied through texPhone()');
  ok(st.preloadFn, 'the neighbour preload exists (wmPreloadNeigh)');
  ok(st.cacheOffDom, 'preloads load off the DOM (WM_PRELOAD_CACHE = new Map()), so they cannot repaint the visible list');
  ok(st.bothDirs, 'both adjacent levels are preloaded: lodCap(rl[lodIdx-1]) and lodCap(rl[lodIdx+1])');
  ok(st.ringOne, 'the ring on a neighbour level is clamped (Math.min(ring, ...)) - never beyond 1 tile of THAT level');
  ok(st.fade250, 'the swap fades over 0.25 s (opacity .25s)');
  ok(!st.tearOff, 'no timed tear-off left inside applyMapLOD (the base\'s setTimeout(lodArm,3000) is gone)');
  ok(st.genGuard, 'each LOD change gets a generation id (layer._realmGen = ++_lodGen)');
  ok(st.holdOld, 'the sweep holds the old level while a newer zoom is pending (layer._realmGen !== gen -> return; gen is captured per LOD change)');
  ok(br.errors.length === 0, 'no page errors during the zoom (' + br.errors.slice(0, 2).join(' | ') + ')');
  ok(br.close.srcs.length > 0, 'the close level draws tiles before the zoom (' + br.close.srcs.length + ' img elements)');
  ok(br.mid.srcs.length > 0 && br.close.srcs.every(s => br.mid.srcs.indexOf(s) >= 0),
    'the OLD level is still on screen 1200 ms into the swap (all ' + br.close.srcs.length + ' close-level tile srcs still in the DOM, ' + br.mid.srcs.length + ' tiles up)');
  ok(br.reqMid > 0, 'the next level is requested BEFORE the boundary (' + br.reqMid + ' tile requests fired while still on the close level)');
  ok(br.reqMid <= st.cap, 'the preload count is capped (' + br.reqMid + ' <= WM_LOD_CAP ' + st.cap + ')');
  ok(!(br.phone && br.reqMid > st.capPhone), 'on a phone the preload count respects the phone cap (' + br.reqMid + ' vs WM_LOD_CAP_PHONE ' + st.capPhone + ')');
  ok(br.after.srcs.length > 0 && br.after.srcs.some(s => br.close.srcs.indexOf(s) < 0),
    'the swap completed to the far level (' + br.after.srcs.length + ' tiles up, new srcs replaced the close level\'s)');
  ok(br.rapid.bCount > 0, 'the rapid A->B pair painted B\'s tiles (' + br.rapid.bCount + ' img elements right after zoom B)');
  ok(br.rapid.bKept === br.rapid.bCount, 'the rapid A->B case: A\'s cleanup removed none of B\'s tiles - all ' + br.rapid.bCount + ' of B\'s tiles are still painted at the end (' + br.rapid.bKept + ' kept)');
  ok(br.rapid.endCount > 0, 'the layer is never left empty through the rapid A->B pair (' + br.rapid.endCount + ' tiles up at the end)');
}

async function runOn(dir, tag, ok) {
  const S = await R.server({ dir });
  try {
    const B = await R.boot(S, tag, 1);
    return { st: staticChecks(dir), br: await browserChecks(S, B) };
  } finally { await S.kill(); }
}

(async () => {
  let failed = false;
  try {
    console.log('== this tree');
    const mine = await runOn(R.root, 'mz', R.ok);
    judge(mine.st, mine.br, R.ok);
    console.log('== control ' + CONTROL_SHA + ' (must fail)');
    let ctlFailed = 0;
    const quiet = (c, m) => assert.ok(c, m);
    let ctl = null;
    try { ctl = await runOn(R.controlTree(CONTROL_SHA), 'zc', quiet); }
    catch (e) { ctlFailed++; console.log('  control run threw: ' + String(e).slice(0, 200)); }
    if (ctl) { try { judge(ctl.st, ctl.br, quiet); } catch (e) { ctlFailed++; console.log('  control fails as it must: ' + String(e && e.message || e).slice(0, 200)); } }
    R.ok(ctlFailed >= 1, 'CONTROL ' + CONTROL_SHA + ' fails the v1234 checks (' + ctlFailed + ' failing part(s))');
  } catch (e) { failed = true; console.error('FAIL ' + (e && e.stack || e)); }
  finally { try { R.removeControlTree(CONTROL_SHA); } catch (_) {} }
  console.log('test_map_zoom_smooth_1234.js: ' + R.passed() + ' checks passed, ' + (failed ? 1 : 0) + ' failed');
  process.exit(failed ? 1 : 0);
})();
